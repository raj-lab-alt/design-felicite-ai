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

export interface VisionResponse {
  text: string
  usage: TokenUsage
  durationMs: number
  modelVersion: string | null
}

export interface VisionProvider {
  complete(request: VisionRequest): Promise<VisionResponse>
}

export interface ImageGenRequest {
  model: string
  prompt: string
  referenceImages: Array<{ mimeType: string; base64: string }>
  signal?: AbortSignal
}

export interface ImageGenResponse {
  mimeType: string
  base64: string
  durationMs: number
  modelVersion: string | null
}

export interface ImageGenerationProvider {
  generate(request: ImageGenRequest): Promise<ImageGenResponse>
}

export type GeminiClientFactory = () => GoogleGenAI
