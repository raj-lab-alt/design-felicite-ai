import { GoogleGenAI } from '@google/genai'
import { AppError } from '@shared/errors'

let cachedClient: GoogleGenAI | null = null

/** Crée (et met en cache) un client Gemini pour la clé fournie. La clé ne quitte jamais le process principal. */
export function createGeminiClient(apiKey: string): GoogleGenAI {
  if (!apiKey.trim()) {
    throw new AppError('ERR_API_NOT_CONFIGURED')
  }
  if (cachedClient) return cachedClient
  cachedClient = new GoogleGenAI({ apiKey: apiKey.trim() })
  return cachedClient
}

export function resetGeminiClient(): void {
  cachedClient = null
}