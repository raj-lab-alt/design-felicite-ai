import { AppError } from '@shared/errors'
import { TIMEOUTS } from '@shared/constants'
import type { ConnectionTestResultDTO } from '@shared/ipc'
import type { AppSettings } from '@shared/schemas'
import type { SecureStorageService } from '../services/SecureStorageService'
import type { SettingsService } from '../services/SettingsService'
import { createGeminiClient, resetGeminiClients } from './client'
import { runWithFailover } from './failover'
import { GeminiVisionProvider } from './GeminiVisionProvider'
import { GeminiImageGenerationProvider } from './GeminiImageGenerationProvider'
import { mapGeminiError } from './errors'
import type {
  GeminiClientFactory,
  ImageGenRequest,
  ImageGenResponse,
  ProviderImageGenResponse,
  ProviderVisionResponse,
  TokenUsage,
  VisionRequest,
  VisionResponse
} from './types'
import { logger } from '../utils/logger'

interface AttemptContext {
  keyIndex: number
  model: string
}

/**
 * Point d'accès unique au service Gemini.
 *
 * Bascule automatique :
 * - plusieurs clés API peuvent être configurées (ordre = priorité) ;
 * - plusieurs modèles peuvent être listés (premier = principal) ;
 * - en cas de clé épuisée/refusée (quota, auth, débit) la clé suivante est essayée ;
 * - en cas de modèle indisponible/sans réponse, le modèle suivant est essayé ;
 * - les clés ne sont jamais exposées au renderer, aux logs ni aux réponses IPC.
 */
export class GeminiService {
  /** Index de la clé préférée mémorisé en mémoire (bascule après succès). */
  private preferredKeyIndex = 0

  constructor(
    private readonly secureStorage: SecureStorageService,
    private readonly settings: SettingsService
  ) {}

  getApiKey(): string | null {
    return this.secureStorage.getApiKey()
  }

  isConfigured(): boolean {
    return this.secureStorage.hasKey()
  }

  /** Nombre de clés configurées (exposé, jamais les clés). */
  keyCount(): number {
    return this.secureStorage.keyCount()
  }

  private keys(): string[] {
    return this.secureStorage.getApiKeys()
  }

  private clientFactory(keyIndex: number): GeminiClientFactory {
    return () => {
      const key = this.keys()[keyIndex]
      if (!key) throw new AppError('ERR_API_NOT_CONFIGURED')
      return createGeminiClient(key)
    }
  }

  /**
   * Analyse vision+texte avec bascule clé/modèle. Les modèles proviennent des
   * paramètres (analyseModels) sauf si une liste explicite est fournie.
   */
  async completeVision(request: Omit<VisionRequest, 'model'>, models?: string[]): Promise<VisionResponse> {
    return this.runWithFailover<VisionResponse, ProviderVisionResponse>(
      'vision',
      models,
      (ctx, factory) => new GeminiVisionProvider(factory).complete({ ...request, model: ctx.model }),
      (outcome) => ({ ...outcome.result, model: outcome.model, apiKeyIndex: outcome.keyIndex, failoverAttempts: outcome.attempts })
    )
  }

  /** Génération d'image avec même mécanique de bascule clé/modèle. */
  async generateImage(
    request: Omit<ImageGenRequest, 'model'>,
    models?: string[]
  ): Promise<ImageGenResponse> {
    return this.runWithFailover<ImageGenResponse, ProviderImageGenResponse>(
      'image',
      models,
      (ctx, factory) => new GeminiImageGenerationProvider(factory).generate({ ...request, model: ctx.model }),
      (outcome) => ({ ...outcome.result, model: outcome.model, apiKeyIndex: outcome.keyIndex, failoverAttempts: outcome.attempts })
    )
  }

  private async runWithFailover<T, P>(
    kind: 'vision' | 'image',
    modelsOverride: string[] | undefined,
    attempt: (ctx: AttemptContext, factory: GeminiClientFactory) => Promise<P>,
    decorate: (outcome: {
      result: P
      keyIndex: number
      model: string
      attempts: number
      usedFallback: boolean
    }) => T
  ): Promise<T> {
    const keys = this.keys()
    if (keys.length === 0) throw new AppError('ERR_API_NOT_CONFIGURED')

    const settings = this.settings.get()
    const defaultModels = kind === 'vision' ? settings.analysisModels : settings.imageModels
    const models = modelsOverride && modelsOverride.length > 0 ? modelsOverride : defaultModels
    const startKeyIndex = Math.min(Math.max(this.preferredKeyIndex, 0), Math.max(keys.length - 1, 0))

    const outcome = await runWithFailover<P>({
      keysLen: keys.length,
      models,
      startKeyIndex,
      attempt: (keyIndex, model) => attempt({ keyIndex, model }, this.clientFactory(keyIndex))
    })

    this.preferredKeyIndex = outcome.keyIndex
    if (outcome.usedFallback) {
      logger.warn('Bascule Gemini active', {
        kind,
        model: outcome.model,
        keyIndex: outcome.keyIndex,
        attempts: outcome.attempts
      })
    }
    return decorate({
      result: outcome.result,
      keyIndex: outcome.keyIndex,
      model: outcome.model,
      attempts: outcome.attempts,
      usedFallback: outcome.usedFallback
    })
  }

  async testConnection(): Promise<ConnectionTestResultDTO> {
    const settings = this.settings.get()
    const started = Date.now()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUTS.connectionTestMs)
    try {
      const response = await this.completeVision(
        {
          systemPrompt: 'Réponds uniquement avec le mot AUTH_OK.',
          instruction: 'Test de connexion.',
          images: [],
          maxOutputTokens: 8,
          signal: controller.signal
        },
        settings.analysisModels
      )
      const message =
        response.failoverAttempts > 1
          ? 'Connexion établie avec une clé ou un modèle de secours.'
          : 'Connexion établie.'
      return {
        ok: true,
        model: response.model,
        latencyMs: Date.now() - started,
        message,
        apiKeyIndex: response.apiKeyIndex,
        usedFallback: response.failoverAttempts > 1,
        attempts: response.failoverAttempts
      }
    } catch (error) {
      const appError = mapGeminiError(error)
      return {
        ok: false,
        model: settings.analysisModels[0] ?? '',
        latencyMs: Date.now() - started,
        message: appError.userMessage,
        errorCode: appError.code,
        usedFallback: false,
        attempts: 1
      }
    } finally {
      clearTimeout(timer)
    }
  }

  /** À appeler quand les clés changent : réinitialise cache de clients et index préféré. */
  onKeysChanged(): void {
    this.preferredKeyIndex = 0
    resetGeminiClients()
  }

  /** Coût estimé d'une analyse à partir de la consommation en jetons. */
  estimateAnalysisCost(tokens: TokenUsage, settings: AppSettings): number {
    const prompt = tokens.promptTokens ?? 0
    const output = tokens.outputTokens ?? 0
    return (
      (prompt / 1_000_000) * settings.analysisInputPricePerMTok +
      (output / 1_000_000) * settings.analysisOutputPricePerMTok
    )
  }

  estimateImageCost(): number {
    return this.settings.get().imagePricePerImage
  }

  logUsage(model: string, tokens: TokenUsage): void {
    logger.info('Consommation Gemini', { model, ...tokens })
  }
}