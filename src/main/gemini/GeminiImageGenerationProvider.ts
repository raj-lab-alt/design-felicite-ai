import { AppError } from '@shared/errors'
import { mapGeminiError } from './errors'
import { buildContents } from './GeminiVisionProvider'
import type {
  GeminiClientFactory,
  ImageGenerationProvider,
  ImageGenRequest,
  ProviderImageGenResponse
} from './types'

export class GeminiImageGenerationProvider implements ImageGenerationProvider {
  constructor(private readonly getClient: GeminiClientFactory) {}

  async generate(request: ImageGenRequest): Promise<ProviderImageGenResponse> {
    const ai = this.getClient()
    const started = Date.now()
    try {
      const prompt = request.prompt.trim()
      if (!prompt) throw new AppError('ERR_VALIDATION', 'Le prompt de redesign est vide.')

      const response = await ai.models.generateContent({
        model: request.model,
        contents: buildContents(prompt, request.referenceImages),
        config: {
          // 'X_MEDIA' force une sortie image pour les modèles d'image dédiés (Nano Banana).
          responseModalities: ['X_MEDIA'] as unknown as import('@google/genai').Modality[],
          abortSignal: request.signal
        }
      })

      const parts = response.candidates?.[0]?.content?.parts ?? []
      const media = parts.find((p) => p.inlineData?.data && p.inlineData?.mimeType)
      if (!media?.inlineData) {
        const feedback = response.promptFeedback
        if (feedback?.blockReason) {
          throw new AppError('ERR_REQUEST_REFUSED', 'Génération refusée par le modèle.', {
            details: { blockReason: feedback.blockReason }
          })
        }
        throw new AppError('ERR_RESPONSE_EMPTY', 'Le modèle n’a pas renvoyé d’image.')
      }

      return {
        mimeType: media.inlineData.mimeType as string,
        base64: media.inlineData.data as string,
        durationMs: Date.now() - started,
        modelVersion: response.modelVersion ?? null
      }
    } catch (error) {
      throw mapGeminiError(error)
    }
  }
}