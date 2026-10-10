import type { Part } from '@google/genai'
import { AppError } from '@shared/errors'
import { mapGeminiError } from './errors'
import type {
  GeminiClientFactory,
  ProviderVisionResponse,
  TokenUsage,
  VisionProvider,
  VisionRequest
} from './types'

export function buildContents(
  instruction: string,
  images: Array<{ mimeType: string; base64: string }>
): Part[] {
  const parts: Part[] = [{ text: instruction }]
  for (const image of images) {
    parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } })
  }
  return parts
}

export class GeminiVisionProvider implements VisionProvider {
  constructor(private readonly getClient: GeminiClientFactory) {}

  async complete(request: VisionRequest): Promise<ProviderVisionResponse> {
    const ai = this.getClient()
    const started = Date.now()
    try {
      const response = await ai.models.generateContent({
        model: request.model,
        contents: buildContents(request.instruction, request.images),
        config: {
          systemInstruction: request.systemPrompt,
          temperature: request.temperature ?? 0.2,
          responseMimeType: request.responseJsonSchema ? 'application/json' : undefined,
          responseJsonSchema: request.responseJsonSchema ?? undefined,
          maxOutputTokens: request.maxOutputTokens ?? 4096,
          abortSignal: request.signal
        }
      })
      const text = response.text
      if (!text || text.trim().length === 0) {
        throw new AppError('ERR_RESPONSE_EMPTY', 'Le modèle a renvoyé une réponse vide.')
      }
      const usage = response.usageMetadata
      const tokens: TokenUsage = {
        promptTokens: usage?.promptTokenCount ?? null,
        outputTokens: usage?.candidatesTokenCount ?? null,
        totalTokens: usage?.totalTokenCount ?? null
      }
      return {
        text,
        usage: tokens,
        durationMs: Date.now() - started,
        modelVersion: response.modelVersion ?? null
      }
    } catch (error) {
      throw mapGeminiError(error)
    }
  }
}