import { ApiError } from '@google/genai'
import { AppError } from '@shared/errors'

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')
}

/** Traduit une erreur du SDK Google GenAI en AppError stable, sans exposer de secret. */
export function mapGeminiError(error: unknown): AppError {
  if (error instanceof AppError) return error

  if (error instanceof Error && error.name === 'TimeoutError') {
    return new AppError('ERR_TIMEOUT', "Le délai d'attente du service a été dépassé.", { retryable: true })
  }
  if (error instanceof Error && error.name === 'AbortError') {
    return new AppError('ERR_CANCELLED', 'Requête annulée.')
  }

  if (error instanceof ApiError) {
    const status = error.status
    const raw = typeof error.message === 'string' ? error.message : ''
    const lower = raw.toLowerCase()

    if (status === 401 || status === 403) {
      return new AppError('ERR_API_UNAUTHORIZED', 'Accès refusé par le service Gemini.', {
        details: { status },
        cause: error
      })
    }
    if (status === 404) {
      return new AppError('ERR_MODEL_UNAVAILABLE', 'Modèle introuvable pour cette clé API.', {
        details: { status },
        cause: error
      })
    }
    if (status === 429 || lower.includes('resource_exhausted')) {
      if (lower.includes('quota') || lower.includes('billing')) {
        return new AppError('ERR_QUOTA_EXCEEDED', 'Quota épuisé.', { details: { status }, cause: error })
      }
      return new AppError('ERR_RATE_LIMITED', 'Limite de débit atteinte.', {
        details: { status },
        retryable: true,
        cause: error
      })
    }
    if (status === 400) {
      if (
        lower.includes('safety') ||
        lower.includes('blocked') ||
        lower.includes('prohibited') ||
        lower.includes('recitation')
      ) {
        return new AppError('ERR_REQUEST_REFUSED', 'Requête refusée par le service.', {
          details: { status },
          cause: error
        })
      }
      return new AppError('ERR_VALIDATION', 'Requête invalide envoyée au service.', {
        details: { status },
        cause: error
      })
    }
    if (status >= 500) {
      return new AppError('ERR_NETWORK', 'Le service Gemini est momentanément indisponible.', {
        details: { status },
        retryable: true,
        cause: error
      })
    }
    return new AppError('ERR_UNKNOWN', `Erreur du service Gemini (${status}).`, {
      details: { status },
      cause: error
    })
  }

  if (error instanceof TypeError) {
    return new AppError('ERR_NETWORK', 'Connexion au service impossible.', { retryable: true, cause: error })
  }

  if (error instanceof Error) {
    const lower = error.message.toLowerCase()
    if (lower.includes('fetch failed') || lower.includes('network') || lower.includes('socket')) {
      return new AppError('ERR_NETWORK', 'Connexion au service impossible.', { retryable: true, cause: error })
    }
    return new AppError('ERR_UNKNOWN', error.message, { cause: error })
  }

  return new AppError('ERR_UNKNOWN', String(error))
}
