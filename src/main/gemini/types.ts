import type { GoogleGenAI } from '@google/genai'

export interface TokenUsage {
  promptTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
}

export interface VisionRequest {
  systemPrompt: string
  instruction: string
  images: Array<{ mimeType: string; base64: string }>
  model: string
  responseJsonSchema?: Record<string, unknown>
  temperature?: number
  maxOutputTokens?: number
  signal?: AbortSignal
}

/** Réponse brute du provider (avant enrichissement par la bascule). */
export interface ProviderVisionResponse {
  text: string
  usage: TokenUsage
  durationMs: number
  modelVersion: string | null
}

export interface VisionResponse extends ProviderVisionResponse {
  /** Modèle réellement utilisé (après bascule éventuelle). Renseigné par GeminiService. */
  model: string
  /** Index de la clé réellement utilisée (0 = principale). Renseigné par GeminiService. */
  apiKeyIndex: number
  /** Nombre de tentatives clé/modèle effectuées (1 = succès direct). */
  failoverAttempts: number
}

export interface VisionProvider {
  complete(request: VisionRequest): Promise<ProviderVisionResponse>
}

export interface ImageGenRequest {
  model: string
  prompt: string
  referenceImages: Array<{ mimeType: string; base64: string }>
  signal?: AbortSignal
}

export interface ProviderImageGenResponse {
  mimeType: string
  base64: string
  durationMs: number
  modelVersion: string | null
}

export interface ImageGenResponse extends ProviderImageGenResponse {
  /** Modèle réellement utilisé (après bascule éventuelle). Renseigné par GeminiService. */
  model: string
  /** Index de la clé réellement utilisée (0 = principale). Renseigné par GeminiService. */
  apiKeyIndex: number
  /** Nombre de tentatives clé/modèle effectuées (1 = succès direct). */
  failoverAttempts: number
}

export interface ImageGenerationProvider {
  generate(request: ImageGenRequest): Promise<ProviderImageGenResponse>
}

export type GeminiClientFactory = () => GoogleGenAI
