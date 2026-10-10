import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import pdfmake from 'pdfmake'
import robotoFonts from 'pdfmake/fonts/Roboto.js'
import { APP_NAME } from '@shared/constants'
import { AppError } from '@shared/errors'
import { exportRequestSchema, type ExportRequest, type DesignReport } from '@shared/schemas'
import type { ExportDTO, ImageDTO } from '@shared/ipc'
import type { DatabaseService } from '../db/DatabaseService'
import type { MediaService } from './MediaService'
import type { DesignAnalysisService } from './DesignAnalysisService'
import { newId, nowIso } from '../utils/ids'
import { logger } from '../utils/logger'

interface ExportRow {
  id: string
  project_id: string
  analysis_id: string
  format: string
  file_path: string
  created_at: string
}

let fontsConfigured = false

function configureFonts(): void {
  if (fontsConfigured) return
  pdfmake.setFonts(robotoFonts)
  // Aucun téléchargement d'URL externe ne doit être possible (défense en profondeur).
  pdfmake.setUrlAccessPolicy(() => false)
  fontsConfigured = true
}

export class ExportService {
  constructor(
    private readonly db: DatabaseService,
    private readonly media: MediaService,
    private readonly analysis: DesignAnalysisService,
    private readonly exportsDir: string
  ) {}

  async create(request: ExportRequest): Promise<ExportDTO> {
    const req = exportRequestSchema.parse(request)
    const detail = this.analysis.detail(req.analysisId)
    if (detail.projectId !== req.projectId) {
      throw new AppError('ERR_VALIDATION', 'L’analyse ne concerne pas ce projet.')
    }
    if (!detail.report) {
      throw new AppError('ERR_VALIDATION', 'Aucun rapport disponible pour l’export.')
    }
    const project = this.db.get<{ name: string }>(`SELECT name FROM projects WHERE id = ?`, [req.projectId])
    if (!project) throw new AppError('ERR_NOT_FOUND', 'Projet introuvable.')

    mkdirSync(this.exportsDir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const base = `rapport-${sanitize(project.name)}-${stamp}`
    const id = newId('exp')
    const createdAt = nowIso()

    let filePath: string
    try {
      if (req.format === 'json') {
        filePath = join(this.exportsDir, `${base}.json`)
        const payload = {
          app: APP_NAME,
          exportedAt: createdAt,
          project: { id: req.projectId, name: project.name },
          analysisId: req.analysisId,
          report: detail.report
        }
        writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8')
      } else {
        filePath = join(this.exportsDir, `${base}.pdf`)
        configureFonts()
        const docDefinition = this.buildDocDefinition(project.name, detail.report, req.analysisId, detail.image)
        const doc = pdfmake.createPdf(docDefinition)
        const buffer = await doc.getBuffer()
        writeFileSync(filePath, buffer)
      }
    } catch (error) {
      logger.error('Export échoué', { error: (error as Error).message })
      throw new AppError('ERR_EXPORT', "L'export a échoué.", { cause: error })
    }

    this.db.run(
      `INSERT INTO exports (id, project_id, analysis_id, format, file_path, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, req.projectId, req.analysisId, req.format, filePath, createdAt]
    )
    logger.info('Export créé', { exportId: id, format: req.format, filePath })
    return { id, projectId: req.projectId, analysisId: req.analysisId, format: req.format, filePath, createdAt }
  }

  list(projectId: string): ExportDTO[] {
    const rows = this.db.all<ExportRow>(
      `SELECT * FROM exports WHERE project_id = ? ORDER BY created_at DESC`,
      [projectId]
    )
    return rows.map((r) => this.mapRow(r))
  }

  delete(id: string): void {
    const row = this.db.get<ExportRow>(`SELECT * FROM exports WHERE id = ?`, [id])
    if (!row) return
    this.safeDelete(row.file_path)
    this.db.run(`DELETE FROM exports WHERE id = ?`, [id])
  }

  private safeDelete(filePath: string): void {
    try {
      const root = resolve(this.exportsDir)
      const target = resolve(filePath)
      if (!target.startsWith(root)) {
        logger.warn('Suppression d’export refusée (hors dossier)', { filePath })
        return
      }
      if (existsSync(target)) rmSync(target, { force: true })
    } catch (error) {
      logger.warn('Suppression de fichier export impossible', { error: (error as Error).message })
    }
  }

  private buildDocDefinition(
    projectName: string,
    report: DesignReport,
    analysisId: string,
    image: ImageDTO | null
  ): Record<string, unknown> {
    const content: unknown[] = []
    const images: Record<string, Buffer> = {}

    content.push({ text: APP_NAME, style: 'brand' })
    content.push({ text: "Rapport d'analyse de design", style: 'title' })
    content.push({
      text: [
        { text: 'Projet : ', bold: true },
        projectName,
        '\n',
        { text: 'Analyse : ', bold: true },
        analysisId,
        '\n',
        { text: 'Modèle : ', bold: true },
        report.modelMetadata.model,
        '   ',
        { text: 'Protocole : ', bold: true },
        report.protocolVersion,
        '\n',
        { text: 'Généré le : ', bold: true },
        formatDate(report.modelMetadata.generatedAt)
      ],
      style: 'meta'
    })

    if (image) {
      try {
        const buffer = this.media.readFile((image as unknown as { id?: string }).id ?? '')
        images.main = buffer
        content.push({ image: 'main', fit: [260, 260], margin: [0, 4, 0, 12] })
      } catch {
        // Image indisponible : le rapport textuel reste valable.
      }
    }

    content.push(heading('Synthèse'))
    content.push({ text: report.productSummary, margin: [0, 0, 0, 6] })
    content.push({
      text: `Catégorie détectée : ${report.productCategory.label} (confiance ${(report.productCategory.confidence * 100).toFixed(0)} %)`,
      style: 'muted'
    })

    content.push(heading('Indice Félicité'))
    const indexValue = report.felicityIndex.value
    content.push({
      text: indexValue === null ? 'Non calculable' : `${indexValue} / 100`,
      style: 'index'
    })
    content.push({ text: report.felicityIndex.formula, style: 'muted' })

    content.push(heading('Scores par dimension'))
    content.push({
      table: {
        headerRows: 1,
        widths: ['*', 'auto', 'auto'],
        body: [
          [
            { text: 'Dimension', bold: true },
            { text: 'Score', bold: true },
            { text: 'Poids', bold: true }
          ],
          ...report.scores.map((s) => [
            s.label,
            s.value === null ? '—' : String(s.value),
            `${Math.round(s.weight * 100)} %`
          ])
        ]
      },
      layout: 'lightHorizontalLines'
    })

    if (report.scores.some((s) => s.heuristicNote)) {
      content.push(heading('Contrôles heuristiques'))
      for (const s of report.scores) {
        if (s.heuristicNote) content.push({ text: `• ${s.label} : ${s.heuristicNote}`, margin: [0, 0, 0, 3] })
      }
    }

    content.push(heading('Hiérarchie visuelle'))
    for (const item of report.visualHierarchy) {
      content.push({ text: `Niveau ${item.level} — ${item.element} : ${item.note}`, margin: [0, 0, 0, 2] })
    }

    content.push(heading('Analyse de l’attention (hypothèses)'))
    content.push({ text: report.attentionAnalysis.visualPathHypothesis })
    if (report.attentionAnalysis.competingElements.length > 0) {
      content.push({ text: 'Éléments concurrents :', bold: true, margin: [0, 4, 0, 2] })
      for (const el of report.attentionAnalysis.competingElements) content.push({ text: `• ${el}` })
    }

    content.push(heading('Hypothèses émotionnelles'))
    for (const h of report.emotionalHypotheses) {
      content.push({ text: `${h.emotion} : ${h.hypothesis}`, margin: [0, 0, 0, 2] })
      if (h.conditions) content.push({ text: `Conditions : ${h.conditions}`, style: 'muted' })
    }

    content.push(heading('Valeur perçue'))
    content.push({ text: report.perceivedValueAnalysis.summary })
    pushList(content, 'Facteurs valorisants', report.perceivedValueAnalysis.valueIncreasers)
    pushList(content, 'Facteurs dévalorisants', report.perceivedValueAnalysis.valueReducers)
    pushList(content, 'Informations inconnues', report.perceivedValueAnalysis.unknownInformation)

    content.push(heading('Frottements commerciaux'))
    content.push({ text: report.commercialFriction.summary })
    pushList(content, 'Freins identifiés', report.commercialFriction.frictionPoints)
    pushList(content, 'Éléments rassurants', report.commercialFriction.reassuranceElements)

    content.push(heading('Point de félicité recommandé'))
    const fp = report.felicityPoint
    content.push({ text: `Élément focal : ${fp.recommendedFocalElement}` })
    content.push({ text: `Placement : ${fp.placement}` })
    content.push({ text: `Taille relative : ${fp.relativeSize}` })
    content.push({ text: `Couleur / finition / texture : ${fp.colorFinishTexture}` })
    content.push({ text: `Contraste à renforcer : ${fp.contrastToStrengthen}` })
    content.push({ text: `Complexité : ${fp.complexityGuidance}` })
    content.push({ text: `Émotion / valeur primaire : ${fp.primaryEmotionOrValue}` })
    content.push({ text: `Compromis assumé : ${fp.compromiseExplanation}`, style: 'muted' })

    content.push(heading('Recommandations prioritaires'))
    for (const rec of report.priorityRecommendations) {
      content.push({
        text: `${rec.priority}. ${rec.title} (impact ${impactLabel(rec.expectedImpact)})`,
        bold: true,
        margin: [0, 4, 0, 2]
      })
      content.push({ text: `Constat : ${rec.observedProblem}` })
      content.push({ text: `Modification proposée : ${rec.proposedChange}` })
      if (rec.estimatedCost) content.push({ text: `Coût estimé : ${rec.estimatedCost}`, style: 'muted' })
      if (rec.suggestedTest) content.push({ text: `Test suggéré : ${rec.suggestedTest}`, style: 'muted' })
    }

    content.push(heading('Brief de redesign'))
    const rb = report.redesignBrief
    content.push({ text: rb.artDirection })
    pushList(content, 'Éléments à préserver', rb.elementsToPreserve)
    pushList(content, 'Éléments à éviter', rb.elementsToAvoid)

    content.push(heading('Plan de test'))
    for (const step of report.testingPlan) {
      content.push({ text: `• ${step.step} — ${step.metric} (${step.note})` })
    }

    content.push(heading('Décision finale'))
    content.push({ text: report.finalDecision.diagnosis })
    pushList(content, 'Trois priorités', report.finalDecision.threePriorities)
    if (report.finalDecision.validationPlan) {
      content.push({ text: `Plan de validation : ${report.finalDecision.validationPlan}`, margin: [0, 4, 0, 0] })
    }

    content.push(heading('Hypothèses et limites'))
    pushList(content, 'Hypothèses', report.assumptions)
    pushList(content, 'Limites', report.limitations)
    content.push({
      text: 'Ce rapport est une évaluation heuristique de conception. Il ne constitue ni une garantie de vente, ni une mesure neurologique.',
      style: 'disclaimer'
    })

    return {
      pageSize: 'A4',
      pageMargins: [40, 40, 40, 48],
      defaultStyle: { font: 'Roboto', fontSize: 10, lineHeight: 1.3 },
      content,
      images,
      styles: {
        brand: { fontSize: 9, color: '#6d28d9', bold: true, characterSpacing: 1 },
        title: { fontSize: 20, bold: true, margin: [0, 2, 0, 10] },
        meta: { fontSize: 9, color: '#334155', margin: [0, 0, 0, 10] },
        index: { fontSize: 22, bold: true, color: '#6d28d9', margin: [0, 2, 0, 2] },
        muted: { fontSize: 9, color: '#64748b' },
        disclaimer: { fontSize: 8, color: '#94a3b8', italics: true, margin: [0, 12, 0, 0] }
      },
      footer: (currentPage: number, pageCount: number) => ({
        text: `Page ${currentPage} / ${pageCount}`,
        alignment: 'center',
        fontSize: 8,
        color: '#94a3b8',
        margin: [0, 20, 0, 0]
      })
    }
  }

  private mapRow(row: ExportRow): ExportDTO {
    return {
      id: row.id,
      projectId: row.project_id,
      analysisId: row.analysis_id,
      format: row.format as 'pdf' | 'json',
      filePath: row.file_path,
      createdAt: row.created_at
    }
  }
}

function heading(text: string): Record<string, unknown> {
  return { text, fontSize: 13, bold: true, margin: [0, 12, 0, 6], color: '#1e293b' }
}

function pushList(content: unknown[], title: string, items: string[]): void {
  if (items.length === 0) return
  content.push({ text: `${title} :`, bold: true, margin: [0, 4, 0, 2] })
  for (const item of items) content.push({ text: `• ${item}` })
}

function impactLabel(impact: 'low' | 'medium' | 'high'): string {
  return impact === 'high' ? 'élevé' : impact === 'medium' ? 'moyen' : 'faible'
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR')
  } catch {
    return iso
  }
}

function sanitize(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'projet'
}