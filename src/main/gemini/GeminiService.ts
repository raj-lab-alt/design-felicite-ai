import { AppError } from '@shared/errors'
import { TIMEOUTS } from '@shared/constants'
import type { ConnectionTestResultDTO } from '@shared/ipc'
import type { AppSettings } from '@shared/schemas'
import type { SecureStorageService } from '../services/SecureStorageService'
import type { SettingsService } from '../services/SettingsService'
import { createGeminiClient, resetGeminiClient } from './client'
import { GeminiVisionProvider } from './GeminiVisionProvider'
import { GeminiImageGenerationProvider } from './GeminiImageGenerationProvider'
import { mapGeminiError } from './errors'
import type { GeminiClientFactory, TokenUsage } from './types'
import { logger } from '../utils/logger'

/**
 * Point d'accès unique au service Gemini.
 * La clé API est résolue depuis le stockage de confiance à chaque création de client,
 * sans jamais être exposée au renderer, aux logs ou aux réponses IPC.
 */
export class GeminiService {
  private vision: GeminiVisionProvider | null = null
  private image: GeminiImageGenerationProvider | null = null

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

  getClientFactory(): GeminiClientFactory {
    return () => {
      const apiKey = this.secureStorage.getApiKey()
      if (!apiKey) throw new AppError('ERR_API_NOT_CONFIGURED')
      return createGeminiClient(apiKey)
    }
  }

  visionProvider(): GeminiVisionProvider {
    return this.vision ?? (this.vision = new GeminiVisionProvider(this.getClientFactory()))
  }

  imageProvider(): GeminiImageGenerationProvider {
    return this.image ?? (this.image = new GeminiImageGenerationProvider(this.getClientFactory()))
  }

  async testConnection(): Promise<ConnectionTestResultDTO> {
    const settings = this.settings.get()
    const started = Date.now()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUTS.connectionTestMs)
    try {
      await this.visionProvider().complete({
        model: settings.analysisModel,
        systemPrompt: 'Réponds uniquement avec le mot AUTH_OK.',
        instruction: 'Test de connexion.',
        images: [],
        maxOutputTokens: 8,
        signal: controller.signal
      })
      return {
        ok: true,
        model: settings.analysisModel,
        latencyMs: Date.now() - started,
        message: 'Connexion établie.'
      }
    } catch (error) {
      const appError = mapGeminiError(error)
      return {
        ok: false,
        model: settings.analysisModel,
        latencyMs: Date.now() - started,
        message: appError.userMessage,
        errorCode: appError.code
      }
    } finally {
      clearTimeout(timer)
    }
  }

  /** Retire le client en cache après changement de clé API. */
  onApiKeyChanged(): void {
    this.vision = null
    this.image = null
    resetGeminiClient()
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