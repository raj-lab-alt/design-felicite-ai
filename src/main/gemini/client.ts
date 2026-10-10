import { GoogleGenAI } from '@google/genai'
import { AppError } from '@shared/errors'

/**
 * Cache de clients Gemini, un par clé API. Permet de basculer de clé
 * (failover) sans recréer un client à chaque tentative. Les clés ne
 * quittent jamais le processus principal.
 */
const clientsByKey = new Map<string, GoogleGenAI>()

export function createGeminiClient(apiKey: string): GoogleGenAI {
  const key = apiKey.trim()
  if (!key) {
    throw new AppError('ERR_API_NOT_CONFIGURED')
  }
  let client = clientsByKey.get(key)
  if (!client) {
    client = new GoogleGenAI({ apiKey: key })
    clientsByKey.set(key, client)
  }
  return client
}

export function resetGeminiClients(): void {
  clientsByKey.clear()
}