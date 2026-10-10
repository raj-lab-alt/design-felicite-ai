import { AppError } from '@shared/errors'
import {
  experimentCreateSchema,
  experimentResultInputSchema,
  type ExperimentCreate,
  type ExperimentMetric,
  type ExperimentResultInput
} from '@shared/schemas'
import type { ExperimentDTO, ExperimentResultDTO, ExperimentSummaryDTO } from '@shared/ipc'
import type { DatabaseService } from '../db/DatabaseService'
import { newId, nowIso } from '../utils/ids'

/** Nombre minimal d'observations par variante avant toute conclusion (garde-fou honnête). */
const MIN_SAMPLE = 20

const LOWER_IS_BETTER: ReadonlySet<ExperimentMetric> = new Set([
  'cost_per_visit',
  'cost_per_qualified_conversation',
  'cost_per_confirmed_order'
])

interface ExperimentRow {
  id: string
  project_id: string
  name: string
  hypothesis: string
  variant_a_id: string | null
  variant_b_id: string | null
  audience: string
  channel: string
  primary_metric: string
  notes: string
  created_at: string
  updated_at: string
}

interface ResultRow {
  id: string
  experiment_id: string
  variant: string
  metric: string
  value: number
  sample_size: number | null
  source: string
  note: string
  recorded_at: string
}

export class ExperimentService {
  constructor(private readonly db: DatabaseService) {}

  list(projectId: string): ExperimentDTO[] {
    const rows = this.db.all<ExperimentRow>(
      `SELECT * FROM experiments WHERE project_id = ? ORDER BY updated_at DESC`,
      [projectId]
    )
    return rows.map((r) => this.mapExperiment(r))
  }

  create(input: ExperimentCreate): ExperimentDTO {
    const data = experimentCreateSchema.parse(input)
    if (!this.db.get<{ id: string }>(`SELECT id FROM projects WHERE id = ?`, [data.projectId])) {
      throw new AppError('ERR_NOT_FOUND', 'Projet introuvable.')
    }
    const id = newId('exp')
    const now = nowIso()
    this.db.run(
      `INSERT INTO experiments
         (id, project_id, name, hypothesis, variant_a_id, variant_b_id, audience, channel, primary_metric, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.projectId,
        data.name,
        data.hypothesis,
        data.variantAId ?? null,
        data.variantBId ?? null,
        data.audience,
        data.channel,
        data.primaryMetric,
        data.notes,
        now,
        now
      ]
    )
    return this.get(id)
  }

  update(id: string, patch: Partial<ExperimentCreate>): ExperimentDTO {
    const existing = this.get(id)
    const merged = {
      projectId: existing.projectId,
      name: patch.name ?? existing.name,
      hypothesis: patch.hypothesis ?? existing.hypothesis,
      variantAId: patch.variantAId !== undefined ? patch.variantAId : existing.variantAId,
      variantBId: patch.variantBId !== undefined ? patch.variantBId : existing.variantBId,
      audience: patch.audience ?? existing.audience,
      channel: patch.channel ?? existing.channel,
      primaryMetric: patch.primaryMetric ?? existing.primaryMetric,
      notes: patch.notes ?? existing.notes
    }
    const data = experimentCreateSchema.parse(merged)
    this.db.run(
      `UPDATE experiments SET name = ?, hypothesis = ?, variant_a_id = ?, variant_b_id = ?, audience = ?, channel = ?,
        primary_metric = ?, notes = ?, updated_at = ? WHERE id = ?`,
      [
        data.name,
        data.hypothesis,
        data.variantAId ?? null,
        data.variantBId ?? null,
        data.audience,
        data.channel,
        data.primaryMetric,
        data.notes,
        nowIso(),
        id
      ]
    )
    return this.get(id)
  }

  remove(id: string): void {
    const existing = this.db.get<{ id: string }>(`SELECT id FROM experiments WHERE id = ?`, [id])
    if (!existing) return
    this.db.run(`DELETE FROM experiments WHERE id = ?`, [id])
  }

  addResult(experimentId: string, result: ExperimentResultInput): ExperimentResultDTO {
    if (!this.db.get<{ id: string }>(`SELECT id FROM experiments WHERE id = ?`, [experimentId])) {
      throw new AppError('ERR_NOT_FOUND', 'Expérience introuvable.')
    }
    const data = experimentResultInputSchema.parse(result)
    const id = newId('res')
    const now = nowIso()
    this.db.run(
      `INSERT INTO experiment_results
         (id, experiment_id, variant, metric, value, sample_size, source, note, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        experimentId,
        data.variant,
        data.metric,
        data.value,
        data.sampleSize ?? null,
        data.source,
        data.note,
        now
      ]
    )
    this.db.run(`UPDATE experiments SET updated_at = ? WHERE id = ?`, [now, experimentId])
    return this.getResult(id)
  }

  results(experimentId: string): ExperimentResultDTO[] {
    const rows = this.db.all<ResultRow>(
      `SELECT * FROM experiment_results WHERE experiment_id = ? ORDER BY recorded_at ASC`,
      [experimentId]
    )
    return rows.map((r) => this.mapResult(r))
  }

  summary(experimentId: string): ExperimentSummaryDTO {
    const experiment = this.get(experimentId)
    const metric = experiment.primaryMetric
    const rows = this.db.all<ResultRow>(
      `SELECT * FROM experiment_results WHERE experiment_id = ? AND metric = ?`,
      [experimentId, metric]
    )

    const variants: Array<'original' | 'A' | 'B'> = ['original', 'A', 'B']
    const perVariant = variants.map((variant) => {
      const subset = rows.filter((r) => r.variant === variant)
      return { variant, ...this.aggregate(subset), count: subset.length }
    })

    const withData = perVariant.filter((v) => v.average !== null)
    const lowerIsBetter = LOWER_IS_BETTER.has(metric)

    const insufficient = (): ExperimentSummaryDTO => ({
      experimentId,
      metric,
      verdict: 'insufficient_data',
      message: `Données insuffisantes pour conclure : au moins ${MIN_SAMPLE} observations par variante sont nécessaires (recommandation interne prudente).`,
      perVariant: perVariant.map((v) => ({ variant: v.variant, average: v.average, samples: v.samples }))
    })

    if (withData.length < 2) return insufficient()
    if (withData.some((v) => v.samples < MIN_SAMPLE)) return insufficient()

    const sorted = [...withData].sort((a, b) => {
      const av = a.average as number
      const bv = b.average as number
      return lowerIsBetter ? av - bv : bv - av
    })
    const best = sorted[0]
    const second = sorted[1]
    const bestValue = best.average as number
    const secondValue = second.average as number
    const relativeDiff = secondValue !== 0 ? Math.abs(bestValue - secondValue) / Math.abs(secondValue) : bestValue !== 0 ? 1 : 0

    let verdict: ExperimentSummaryDTO['verdict']
    let message: string
    if (relativeDiff < 0.05) {
      verdict = 'no_difference'
      message = 'Écart inférieur à 5 % entre les meilleures variantes : aucune différence exploitable à ce stade.'
    } else {
      verdict = best.variant === 'A' ? 'variant_a' : best.variant === 'B' ? 'variant_b' : 'original'
      const label = best.variant === 'original' ? 'l’original' : `la variante ${best.variant}`
      message = `${label} obtient la meilleure valeur moyenne (${bestValue.toFixed(2)}) sur la métrique « ${metric} », avec un écart de ${(relativeDiff * 100).toFixed(1)} % face à la seconde. Résultat indicatif, non statistiquement significatif.`
    }

    return {
      experimentId,
      metric,
      verdict,
      message,
      perVariant: perVariant.map((v) => ({ variant: v.variant, average: v.average, samples: v.samples }))
    }
  }

  private aggregate(rows: ResultRow[]): { average: number | null; samples: number } {
    if (rows.length === 0) return { average: null, samples: 0 }
    const hasSampleSizes = rows.some((r) => r.sample_size !== null && r.sample_size > 0)
    if (hasSampleSizes) {
      let weightedSum = 0
      let weight = 0
      for (const r of rows) {
        const w = r.sample_size && r.sample_size > 0 ? r.sample_size : 1
        weightedSum += r.value * w
        weight += w
      }
      return { average: weight > 0 ? weightedSum / weight : null, samples: weight }
    }
    const sum = rows.reduce((acc, r) => acc + r.value, 0)
    return { average: sum / rows.length, samples: rows.length }
  }

  private get(id: string): ExperimentDTO {
    const row = this.db.get<ExperimentRow>(`SELECT * FROM experiments WHERE id = ?`, [id])
    if (!row) throw new AppError('ERR_NOT_FOUND', 'Expérience introuvable.')
    return this.mapExperiment(row)
  }

  private getResult(id: string): ExperimentResultDTO {
    const row = this.db.get<ResultRow>(`SELECT * FROM experiment_results WHERE id = ?`, [id])
    if (!row) throw new AppError('ERR_NOT_FOUND', 'Résultat introuvable.')
    return this.mapResult(row)
  }

  private mapExperiment(row: ExperimentRow): ExperimentDTO {
    return {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      hypothesis: row.hypothesis,
      variantAId: row.variant_a_id,
      variantBId: row.variant_b_id,
      audience: row.audience,
      channel: row.channel,
      primaryMetric: row.primary_metric as ExperimentMetric,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }

  private mapResult(row: ResultRow): ExperimentResultDTO {
    return {
      id: row.id,
      experimentId: row.experiment_id,
      variant: row.variant as 'original' | 'A' | 'B',
      metric: row.metric as ExperimentMetric,
      value: row.value,
      sampleSize: row.sample_size,
      source: row.source,
      note: row.note,
      recordedAt: row.recorded_at
    }
  }
}