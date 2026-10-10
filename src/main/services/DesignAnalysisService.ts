import {
  ANALYSIS_MAX_OUTPUT_TOKENS,
  CATEGORY_WEIGHT_PROFILE,
  MAX_REPAIR_ATTEMPTS,
  PROTOCOL_VERSION,
  REPORT_SCHEMA_VERSION
} from '@shared/constants'
import { AppError, toAppError } from '@shared/errors'
import {
  analysisRunRequestSchema,
  designReportSchema,
  modelReportJsonSchema,
  modelReportPayloadSchema,
  type AnalysisRunRequest,
  type DesignReport,
  type ModelReportPayload
} from '@shared/schemas'
import type { AnalysisDetailDTO, AnalysisSummaryDTO, AnalysisStatus } from '@shared/ipc'
import type { ZodError } from 'zod'
import type { DatabaseService } from '../db/DatabaseService'
import { newId, nowIso } from '../utils/ids'
import { logger } from '../utils/logger'
import type { ImageOptimizer } from '../utils/imageOptimizer'
import type { LoadedProtocol } from '../protocol/loadProtocol'
import type { MediaService } from './MediaService'
import type { BrandProfileService } from './BrandProfileService'
import type { SettingsService } from './SettingsService'
import type { GeminiService } from '../gemini/GeminiService'
import type { VisionResponse } from '../gemini/types'
import type { ProgressHub } from './ProgressHub'
import { computeScores } from './ScoresService'
import { buildAnalysisInstruction, buildRepairSuffix, extractJson } from './analysisPrompt'

interface AnalysisRow {
  id: string
  project_id: string
  image_id: string
  status: string
  model: string
  provider: string
  protocol_version: string
  context_json: string
  brand_profile_id: string | null
  error_code: string | null
  product_summary: string | null
  felicity_index: number | null
  created_at: string
  updated_at: string
}

interface ResultRow {
  analysis_id: string
  report_json: string
  report_schema_version: string
  usage_json: string | null
}

export interface AnalysisServiceDeps {
  db: DatabaseService
  media: MediaService
  brandProfiles: BrandProfileService
  settings: SettingsService
  gemini: GeminiService
  protocol: () => LoadedProtocol
  optimizer: ImageOptimizer
  hub: ProgressHub
}

export class DesignAnalysisService {
  private readonly db: DatabaseService
  private readonly media: MediaService
  private readonly brandProfiles: BrandProfileService
  private readonly settings: SettingsService
  private readonly gemini: GeminiService
  private readonly protocol: () => LoadedProtocol
  private readonly optimizer: ImageOptimizer
  private readonly hub: ProgressHub
  private readonly active = new Map<string, AbortController>()
  private readonly activeByImage = new Map<string, string>()

  constructor(deps: AnalysisServiceDeps) {
    this.db = deps.db
    this.media = deps.media
    this.brandProfiles = deps.brandProfiles
    this.settings = deps.settings
    this.gemini = deps.gemini
    this.protocol = deps.protocol
    this.optimizer = deps.optimizer
    this.hub = deps.hub
  }

  async run(request: AnalysisRunRequest): Promise<AnalysisDetailDTO> {
    const parsed = analysisRunRequestSchema.parse(request)
    const { projectId, imageId, brandProfileId } = parsed
    const context = parsed.context

    if (!this.db.get<{ id: string }>(`SELECT id FROM projects WHERE id = ?`, [projectId])) {
      throw new AppError('ERR_NOT_FOUND', 'Projet introuvable.')
    }
    if (this.activeByImage.has(imageId)) {
      throw new AppError('ERR_VALIDATION', 'Une analyse est déjà en cours pour cette image.')
    }
    const image = this.media.getById(imageId)
    if (!image || image.projectId !== projectId) {
      throw new AppError('ERR_NOT_FOUND', 'Image introuvable pour ce projet.')
    }

    const settings = this.settings.get()
    if (!this.gemini.isConfigured()) throw new AppError('ERR_API_NOT_CONFIGURED')
    if (!settings.privacyConsentGivenAt) {
      throw new AppError(
        'ERR_CONSENT_REQUIRED',
        'Le consentement de confidentialité doit être accepté avant tout envoi d’image au service Gemini.'
      )
    }

    const analysisId = newId('anl')
    const startedAt = Date.now()
    const now = nowIso()
    const primaryModel = settings.analysisModels[0] ?? ''
    this.db.run(
      `INSERT INTO analyses
         (id, project_id, image_id, status, model, provider, protocol_version, context_json, brand_profile_id, created_at, updated_at)
       VALUES (?, ?, ?, 'running', ?, 'gemini', ?, ?, ?, ?, ?)`,
      [
        analysisId,
        projectId,
        imageId,
        primaryModel,
        PROTOCOL_VERSION,
        JSON.stringify(context),
        brandProfileId ?? null,
        now,
        now
      ]
    )

    const controller = new AbortController()
    this.active.set(analysisId, controller)
    this.activeByImage.set(imageId, analysisId)

    try {
      this.progress(analysisId, 'prepare', 8, 'Préparation de l’image…')
      const buffer = this.media.readFile(imageId)
      const optimized = await this.optimizer.optimize(buffer, settings.maxUploadSide)

      this.progress(analysisId, 'context', 18, 'Préparation du contexte et du protocole…')
      const protocol = this.protocol()
      const brandProfile = brandProfileId ? this.brandProfiles.get(brandProfileId) : null
      const instruction = buildAnalysisInstruction(context, brandProfile)

      this.progress(analysisId, 'analyze', 30, 'Analyse multimodale en cours…')
      const { payload, response, parseErrors } = await this.requestWithRepair(
        analysisId,
        controller.signal,
        settings.analysisModels,
        protocol.text,
        instruction,
        optimized.mimeType,
        optimized.base64
      )

      this.progress(analysisId, 'score', 72, 'Calcul des scores et de l’Indice Félicité…')
      const weightProfile =
        CATEGORY_WEIGHT_PROFILE[context?.categoryId ?? 'autre'] ?? settings.defaultWeightProfile
      const computed = computeScores(payload, weightProfile)
      const estimatedCost = this.gemini.estimateAnalysisCost(response.usage, settings)

      const report: DesignReport = {
        ...payload,
        analysisId,
        protocolVersion: PROTOCOL_VERSION,
        scores: computed.scores,
        felicityIndex: computed.felicityIndex,
        modelMetadata: {
          provider: 'gemini',
          model: response.model,
          protocolVersion: PROTOCOL_VERSION,
          reportSchemaVersion: REPORT_SCHEMA_VERSION,
          generatedAt: nowIso(),
          durationMs: Date.now() - startedAt,
          usage: { ...response.usage, estimatedCostUsd: estimatedCost }
        }
      }
      const validated = designReportSchema.parse(report)

      this.progress(analysisId, 'persist', 90, 'Enregistrement du rapport…')
      this.persistSuccess(analysisId, projectId, validated, response, estimatedCost)

      if (computed.warnings.length > 0) {
        logger.warn('Analyse terminée avec avertissements', { analysisId, warnings: computed.warnings })
      }
      logger.info('Analyse terminée', {
        analysisId,
        model: response.model,
        keyIndex: response.apiKeyIndex,
        failoverAttempts: response.failoverAttempts,
        latencyMs: Date.now() - startedAt,
        repairs: parseErrors.length
      })

      this.progress(analysisId, 'done', 100, 'Analyse terminée.')
      return this.detail(analysisId)
    } catch (error) {
      const appError = toAppError(error)
      this.persistFailure(analysisId, appError.code)
      logger.error('Analyse échouée', { analysisId, code: appError.code, message: appError.message })
      throw appError
    } finally {
      this.active.delete(analysisId)
      if (this.activeByImage.get(imageId) === analysisId) this.activeByImage.delete(imageId)
    }
  }

  private async requestWithRepair(
    analysisId: string,
    signal: AbortSignal,
    models: string[],
    systemPrompt: string,
    baseInstruction: string,
    mimeType: string,
    base64: string
  ): Promise<{ payload: ModelReportPayload; response: VisionResponse; parseErrors: string[] }> {
    const parseErrors: string[] = []
    let lastResponse: VisionResponse | null = null

    for (let attempt = 0; attempt <= MAX_REPAIR_ATTEMPTS; attempt += 1) {
      if (signal.aborted) throw new AppError('ERR_CANCELLED')
      const instruction =
        attempt === 0 ? baseInstruction : `${baseInstruction}${buildRepairSuffix(parseErrors)}`
      const progress = 30 + Math.round((attempt / (MAX_REPAIR_ATTEMPTS + 1)) * 35)
      this.progress(
        analysisId,
        attempt === 0 ? 'analyze' : 'repair',
        progress,
        attempt === 0 ? 'Analyse multimodale en cours…' : `Tentative de réparation ${attempt}/${MAX_REPAIR_ATTEMPTS}…`
      )

      const response = await this.gemini.completeVision(
        {
          systemPrompt,
          instruction,
          images: [{ mimeType, base64 }],
          responseJsonSchema: modelReportJsonSchema(),
          temperature: attempt === 0 ? 0.2 : 0.1,
          maxOutputTokens: ANALYSIS_MAX_OUTPUT_TOKENS,
          signal
        },
        models
      )
      lastResponse = response

      try {
        const raw = extractJson(response.text)
        const payload = modelReportPayloadSchema.parse(raw)
        return { payload, response, parseErrors }
      } catch (error) {
        const summary = summarizeParseError(error)
        parseErrors.push(...summary)
        logger.warn('Réponse modèle invalide', { analysisId, attempt, errors: summary })
        if (attempt === MAX_REPAIR_ATTEMPTS) {
          throw new AppError('ERR_RESPONSE_INVALID', 'Réponse du modèle invalide après réparation.', {
            details: { errors: summary },
            cause: error
          })
        }
      }
    }

    throw new AppError('ERR_RESPONSE_INVALID', 'Réponse du modèle invalide.', {
      details: lastResponse ? { usage: lastResponse.usage } : {}
    })
  }

  private persistSuccess(
    analysisId: string,
    projectId: string,
    report: DesignReport,
    response: VisionResponse,
    estimatedCost: number
  ): void {
    const now = nowIso()
    this.db.transaction(() => {
      this.db.run(
        `UPDATE analyses SET status = 'completed', model = ?, product_summary = ?, felicity_index = ?, updated_at = ? WHERE id = ?`,
        [response.model, report.productSummary, report.felicityIndex.value, now, analysisId]
      )
      this.db.run(
        `INSERT INTO analysis_results (analysis_id, report_json, report_schema_version, usage_json, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(analysis_id) DO UPDATE SET report_json = excluded.report_json,
           report_schema_version = excluded.report_schema_version, usage_json = excluded.usage_json`,
        [
          analysisId,
          JSON.stringify(report),
          REPORT_SCHEMA_VERSION,
          JSON.stringify({ ...response.usage, estimatedCostUsd: estimatedCost }),
          now
        ]
      )
      this.db.run(`DELETE FROM recommendations WHERE analysis_id = ?`, [analysisId])
      for (const rec of report.priorityRecommendations) {
        this.db.run(
          `INSERT INTO recommendations (analysis_id, rec_id, priority, expected_impact, selected, data)
           VALUES (?, ?, ?, ?, 0, ?)`,
          [analysisId, rec.id, rec.priority, rec.expectedImpact, JSON.stringify(rec)]
        )
      }
      this.db.run(`UPDATE projects SET updated_at = ? WHERE id = ?`, [now, projectId])
    })
  }

  private persistFailure(analysisId: string, code: string): void {
    try {
      this.db.run(`UPDATE analyses SET status = 'failed', error_code = ?, updated_at = ? WHERE id = ?`, [
        code,
        nowIso(),
        analysisId
      ])
    } catch (error) {
      logger.error('Impossible d’enregistrer l’échec d’analyse', { error: (error as Error).message })
    }
  }

  cancel(analysisId: string): void {
    const controller = this.active.get(analysisId)
    if (controller) controller.abort()
  }

  detail(analysisId: string): AnalysisDetailDTO {
    const row = this.db.get<AnalysisRow>(`SELECT * FROM analyses WHERE id = ?`, [analysisId])
    if (!row) throw new AppError('ERR_NOT_FOUND', 'Analyse introuvable.')
    const result = this.db.get<ResultRow>(`SELECT * FROM analysis_results WHERE analysis_id = ?`, [analysisId])
    let report: DesignReport | null = null
    if (result) {
      try {
        report = designReportSchema.parse(JSON.parse(result.report_json))
      } catch (error) {
        logger.warn('Rapport stocké illisible', { analysisId, error: (error as Error).message })
        report = null
      }
    }
    const image = this.media.getById(row.image_id)
    const selected = this.db.all<{ rec_id: string }>(
      `SELECT rec_id FROM recommendations WHERE analysis_id = ? AND selected = 1`,
      [analysisId]
    )
    return {
      ...this.mapSummary(row),
      report,
      image,
      selectedRecommendationIds: selected.map((s) => s.rec_id)
    }
  }

  byProject(projectId: string): AnalysisSummaryDTO[] {
    const rows = this.db.all<AnalysisRow>(
      `SELECT * FROM analyses WHERE project_id = ? ORDER BY created_at DESC`,
      [projectId]
    )
    return rows.map((r) => this.mapSummary(r))
  }

  delete(analysisId: string): void {
    const row = this.db.get<AnalysisRow>(`SELECT * FROM analyses WHERE id = ?`, [analysisId])
    if (!row) return
    this.db.run(`DELETE FROM analyses WHERE id = ?`, [analysisId])
    logger.info('Analyse supprimée', { analysisId })
  }

  selectRecommendations(analysisId: string, selectedIds: string[]): void {
    const exists = this.db.get<{ id: string }>(`SELECT id FROM analyses WHERE id = ?`, [analysisId])
    if (!exists) throw new AppError('ERR_NOT_FOUND', 'Analyse introuvable.')
    const valid = new Set(
      this.db.all<{ rec_id: string }>(`SELECT rec_id FROM recommendations WHERE analysis_id = ?`, [analysisId]).map(
        (r) => r.rec_id
      )
    )
    this.db.transaction(() => {
      this.db.run(`UPDATE recommendations SET selected = 0 WHERE analysis_id = ?`, [analysisId])
      for (const id of selectedIds) {
        if (!valid.has(id)) continue
        this.db.run(`UPDATE recommendations SET selected = 1 WHERE analysis_id = ? AND rec_id = ?`, [analysisId, id])
      }
    })
  }

  private mapSummary(row: AnalysisRow): AnalysisSummaryDTO {
    return {
      id: row.id,
      projectId: row.project_id,
      imageId: row.image_id,
      status: row.status as AnalysisStatus,
      model: row.model,
      protocolVersion: row.protocol_version,
      createdAt: row.created_at,
      felicityIndex: row.felicity_index,
      productSummary: row.product_summary,
      errorCode: (row.error_code as AnalysisSummaryDTO['errorCode']) ?? null
    }
  }

  private progress(analysisId: string, stage: string, progress: number, message: string): void {
    this.hub.analysis({ analysisId, stage, progress, message })
  }
}

function summarizeParseError(error: unknown): string[] {
  const maybeZod = error as ZodError
  if (maybeZod && Array.isArray(maybeZod.issues)) {
    return maybeZod.issues.slice(0, 8).map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '(racine)'
      return `${path} : ${issue.message}`
    })
  }
  if (error instanceof SyntaxError) return [`JSON invalide : ${error.message}`]
  if (error instanceof Error) return [error.message]
  return [String(error)]
}