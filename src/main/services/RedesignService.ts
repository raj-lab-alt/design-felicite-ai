import { IMAGE_LIMITS } from '@shared/constants'
import { AppError, toAppError } from '@shared/errors'
import {
  redesignGenerateRequestSchema,
  type BrandProfile,
  type DesignReport,
  type RedesignGenerateRequest,
  type RedesignMode
} from '@shared/schemas'
import type { RedesignPromptDTO, VariantDTO } from '@shared/ipc'
import type { DatabaseService } from '../db/DatabaseService'
import { newId, nowIso } from '../utils/ids'
import { logger } from '../utils/logger'
import type { ImageOptimizer } from '../utils/imageOptimizer'
import type { MediaService } from './MediaService'
import type { BrandProfileService } from './BrandProfileService'
import type { SettingsService } from './SettingsService'
import type { DesignAnalysisService } from './DesignAnalysisService'
import type { GeminiService } from '../gemini/GeminiService'
import type { ProgressHub } from './ProgressHub'
import { buildRedesignPrompt } from './RedesignPromptBuilder'

interface VariantRow {
  id: string
  project_id: string
  analysis_id: string | null
  parent_variant_id: string | null
  source_image_id: string
  image_id: string | null
  mode: string
  prompt_text: string
  model: string
  status: string
  selected_recommendation_ids: string
  extra_instruction: string
  params_json: string | null
  error_code: string | null
  created_at: string
}

export interface RedesignServiceDeps {
  db: DatabaseService
  media: MediaService
  settings: SettingsService
  gemini: GeminiService
  analysis: DesignAnalysisService
  brandProfiles: BrandProfileService
  optimizer: ImageOptimizer
  hub: ProgressHub
}

export class RedesignService {
  private readonly db: DatabaseService
  private readonly media: MediaService
  private readonly settings: SettingsService
  private readonly gemini: GeminiService
  private readonly analysis: DesignAnalysisService
  private readonly brandProfiles: BrandProfileService
  private readonly optimizer: ImageOptimizer
  private readonly hub: ProgressHub
  private readonly active = new Map<string, AbortController>()

  constructor(deps: RedesignServiceDeps) {
    this.db = deps.db
    this.media = deps.media
    this.settings = deps.settings
    this.gemini = deps.gemini
    this.analysis = deps.analysis
    this.brandProfiles = deps.brandProfiles
    this.optimizer = deps.optimizer
    this.hub = deps.hub
  }

  buildPrompt(request: Omit<RedesignGenerateRequest, 'workingPrompt'>): RedesignPromptDTO {
    const req = redesignGenerateRequestSchema.parse(request)
    const { report, brandProfile } = this.loadContext(req.projectId, req.analysisId)
    const built = buildRedesignPrompt({
      report,
      mode: req.mode,
      selectedRecommendationIds: req.selectedRecommendationIds,
      extraInstruction: req.extraInstruction,
      brandProfile
    })
    return {
      prompt: built.prompt,
      mode: req.mode,
      origin: 'auto',
      selectedRecommendationIds: req.selectedRecommendationIds,
      warnings: built.warnings
    }
  }

  async generate(request: RedesignGenerateRequest): Promise<VariantDTO> {
    const req = redesignGenerateRequestSchema.parse(request)
    const { report, brandProfile } = this.loadContext(req.projectId, req.analysisId)

    const sourceImageId = this.resolveSourceImage(req)
    const sourceImage = this.media.getById(sourceImageId)
    if (!sourceImage || sourceImage.projectId !== req.projectId) {
      throw new AppError('ERR_NOT_FOUND', 'Image source introuvable pour ce projet.')
    }

    let prompt = req.workingPrompt?.trim() ?? ''
    let origin: 'auto' | 'manual' = 'auto'
    let warnings: string[] = []
    if (prompt) {
      origin = 'manual'
    } else {
      const built = buildRedesignPrompt({
        report,
        mode: req.mode,
        selectedRecommendationIds: req.selectedRecommendationIds,
        extraInstruction: req.extraInstruction,
        brandProfile
      })
      prompt = built.prompt
      warnings = built.warnings
    }

    const settings = this.settings.get()
    const variantId = newId('var')
    const base = {
      id: variantId,
      projectId: req.projectId,
      analysisId: req.analysisId,
      parentVariantId: req.sourceVariantId ?? null,
      sourceImageId,
      mode: req.mode as RedesignMode,
      promptText: prompt,
      model: settings.imageModels[0] ?? '',
      selectedRecommendationIds: req.selectedRecommendationIds,
      extraInstruction: req.extraInstruction,
      params: { origin, warnings, mode: req.mode }
    }

    if (!settings.imageGenerationEnabled || !this.gemini.isConfigured()) {
      const code = !this.gemini.isConfigured() ? 'ERR_API_NOT_CONFIGURED' : 'ERR_IMAGE_GENERATION_UNAVAILABLE'
      this.insertVariant({ ...base, status: 'failed', imageId: null, errorCode: code })
      logger.info('Génération indisponible : prompt de redesign enregistré', { variantId, code })
      return this.getVariant(variantId)
    }

    const controller = new AbortController()
    this.active.set(variantId, controller)
    try {
      this.progress(variantId, 'prepare', 10, 'Préparation de l’image de référence…')
      const buffer = this.media.readFile(sourceImageId)
      const optimized = await this.optimizer.optimize(buffer, IMAGE_LIMITS.maxUploadSide)

      this.progress(variantId, 'generate', 40, 'Génération de la variante en cours…')
      const generated = await this.gemini.generateImage({
        prompt,
        referenceImages: [{ mimeType: optimized.mimeType, base64: optimized.base64 }],
        signal: controller.signal
      })

      const outputBuffer = Buffer.from(generated.base64, 'base64')
      const saved = this.media.saveGeneratedImage(
        req.projectId,
        outputBuffer,
        `variant-${variantId}.${generated.mimeType.split('/')[1] ?? 'png'}`,
        'generated'
      )
      this.insertVariant({
        ...base,
        model: generated.model,
        status: 'completed',
        imageId: saved.id,
        errorCode: null
      })
      logger.info('Variante générée', {
        variantId,
        model: generated.model,
        keyIndex: generated.apiKeyIndex,
        failoverAttempts: generated.failoverAttempts,
        durationMs: generated.durationMs
      })
      this.progress(variantId, 'done', 100, 'Variante générée.')
      return this.getVariant(variantId)
    } catch (error) {
      const appError = toAppError(error)
      this.insertVariant({ ...base, status: 'failed', imageId: null, errorCode: appError.code })
      logger.warn('Génération de variante échouée, prompt conservé', { variantId, code: appError.code })
      return this.getVariant(variantId)
    } finally {
      this.active.delete(variantId)
    }
  }

  cancel(variantId: string): void {
    this.active.get(variantId)?.abort()
  }

  variantsByProject(projectId: string): VariantDTO[] {
    const rows = this.db.all<VariantRow>(
      `SELECT * FROM variants WHERE project_id = ? ORDER BY created_at DESC`,
      [projectId]
    )
    return rows.map((r) => this.mapVariant(r))
  }

  variantsByAnalysis(analysisId: string): VariantDTO[] {
    const rows = this.db.all<VariantRow>(
      `SELECT * FROM variants WHERE analysis_id = ? ORDER BY created_at DESC`,
      [analysisId]
    )
    return rows.map((r) => this.mapVariant(r))
  }

  deleteVariant(variantId: string): void {
    const exists = this.db.get<{ id: string }>(`SELECT id FROM variants WHERE id = ?`, [variantId])
    if (!exists) return
    // L'image générée est conservée (elle peut servir de source à d'autres variantes).
    this.db.run(`DELETE FROM variants WHERE id = ?`, [variantId])
    logger.info('Variante supprimée', { variantId })
  }

  private loadContext(
    projectId: string,
    analysisId: string
  ): { report: DesignReport; brandProfile: BrandProfile | null } {
    if (!this.db.get<{ id: string }>(`SELECT id FROM projects WHERE id = ?`, [projectId])) {
      throw new AppError('ERR_NOT_FOUND', 'Projet introuvable.')
    }
    const detail = this.analysis.detail(analysisId)
    if (detail.projectId !== projectId) {
      throw new AppError('ERR_VALIDATION', 'L’analyse ne concerne pas ce projet.')
    }
    if (!detail.report) {
      throw new AppError('ERR_VALIDATION', 'Le rapport d’analyse est indisponible pour générer un redesign.')
    }
    const project = this.db.get<{ brand_profile_id: string | null }>(
      `SELECT brand_profile_id FROM projects WHERE id = ?`,
      [projectId]
    )
    const brandProfile = project?.brand_profile_id ? this.brandProfiles.get(project.brand_profile_id) : null
    return { report: detail.report, brandProfile }
  }

  private resolveSourceImage(req: RedesignGenerateRequest): string {
    if (req.sourceVariantId) {
      const variant = this.db.get<{ image_id: string | null }>(`SELECT image_id FROM variants WHERE id = ?`, [
        req.sourceVariantId
      ])
      if (variant?.image_id) return variant.image_id
    }
    return req.sourceImageId
  }

  private insertVariant(input: {
    id: string
    projectId: string
    analysisId: string
    parentVariantId: string | null
    sourceImageId: string
    imageId: string | null
    mode: RedesignMode
    promptText: string
    model: string
    status: 'completed' | 'failed'
    selectedRecommendationIds: string[]
    extraInstruction: string
    params: Record<string, unknown>
    errorCode: string | null
  }): void {
    this.db.run(
      `INSERT INTO variants
         (id, project_id, analysis_id, parent_variant_id, source_image_id, image_id, mode, prompt_text, model, status,
          selected_recommendation_ids, extra_instruction, params_json, error_code, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.projectId,
        input.analysisId,
        input.parentVariantId,
        input.sourceImageId,
        input.imageId,
        input.mode,
        input.promptText,
        input.model,
        input.status,
        JSON.stringify(input.selectedRecommendationIds),
        input.extraInstruction,
        JSON.stringify(input.params),
        input.errorCode,
        nowIso()
      ]
    )
    this.db.run(`UPDATE projects SET updated_at = ? WHERE id = ?`, [nowIso(), input.projectId])
  }

  private getVariant(variantId: string): VariantDTO {
    const row = this.db.get<VariantRow>(`SELECT * FROM variants WHERE id = ?`, [variantId])
    if (!row) throw new AppError('ERR_NOT_FOUND', 'Variante introuvable.')
    return this.mapVariant(row)
  }

  private mapVariant(row: VariantRow): VariantDTO {
    return {
      id: row.id,
      projectId: row.project_id,
      analysisId: row.analysis_id,
      parentVariantId: row.parent_variant_id,
      sourceImageId: row.source_image_id,
      imageId: row.image_id,
      mode: row.mode as RedesignMode,
      promptText: row.prompt_text,
      model: row.model,
      status: row.status === 'completed' ? 'completed' : 'failed',
      selectedRecommendationIds: safeParseArray(row.selected_recommendation_ids),
      extraInstruction: row.extra_instruction,
      params: row.params_json ? (JSON.parse(row.params_json) as Record<string, unknown>) : null,
      createdAt: row.created_at,
      image: row.image_id ? this.media.getById(row.image_id) : null,
      errorCode: (row.error_code as VariantDTO['errorCode']) ?? null
    }
  }

  private progress(jobId: string, stage: string, progress: number, message: string): void {
    this.hub.redesign({ jobId, stage, progress, message })
  }
}

function safeParseArray(json: string): string[] {
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : []
  } catch {
    return []
  }
}