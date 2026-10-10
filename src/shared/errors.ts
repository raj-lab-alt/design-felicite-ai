/**
 * Gestion centralisée des erreurs applicatives.
 * Chaque erreur possède un code stable, un message utilisateur en français
 * et des détails techniques sans secret.
 */

export type AppErrorCode =
  | 'ERR_UNKNOWN'
  | 'ERR_IMAGE_INVALID'
  | 'ERR_IMAGE_UNSUPPORTED_FORMAT'
  | 'ERR_IMAGE_TOO_LARGE'
  | 'ERR_IMAGE_DECODE'
  | 'ERR_API_NOT_CONFIGURED'
  | 'ERR_API_UNAUTHORIZED'
  | 'ERR_MODEL_UNAVAILABLE'
  | 'ERR_QUOTA_EXCEEDED'
  | 'ERR_RATE_LIMITED'
  | 'ERR_REQUEST_REFUSED'
  | 'ERR_NETWORK'
  | 'ERR_TIMEOUT'
  | 'ERR_RESPONSE_EMPTY'
  | 'ERR_RESPONSE_INVALID'
  | 'ERR_VALIDATION'
  | 'ERR_CONSENT_REQUIRED'
  | 'ERR_STORAGE'
  | 'ERR_DB_LOCKED'
  | 'ERR_DB_CORRUPT'
  | 'ERR_EXPORT'
  | 'ERR_CANCELLED'
  | 'ERR_NOT_FOUND'
  | 'ERR_NOT_READY'
  | 'ERR_ENCRYPTION_UNAVAILABLE'
  | 'ERR_IMAGE_GENERATION_UNAVAILABLE'

const USER_MESSAGES: Record<AppErrorCode, string> = {
  ERR_UNKNOWN: "Une erreur inattendue s'est produite.",
  ERR_IMAGE_INVALID: "Le fichier image est invalide ou illisible.",
  ERR_IMAGE_UNSUPPORTED_FORMAT: 'Le format de cette image n’est pas pris en charge (PNG, JPEG ou WebP).',
  ERR_IMAGE_TOO_LARGE: "L'image dépasse la taille maximale autorisée (20 Mo).",
  ERR_IMAGE_DECODE: "Impossible de décoder cette image.",
  ERR_API_NOT_CONFIGURED:
    'Aucune clé API Gemini n’est configurée. Ajoutez-la dans Paramètres → Configuration Gemini.',
  ERR_API_UNAUTHORIZED: 'La clé API Gemini est refusée ou expirée.',
  ERR_MODEL_UNAVAILABLE: "Le modèle sélectionné n'est pas disponible pour cette clé API.",
  ERR_QUOTA_EXCEEDED: 'Le quota de votre clé API Gemini est épuisé.',
  ERR_RATE_LIMITED: 'Trop de requêtes envoyées. Réessayez dans un instant.',
  ERR_REQUEST_REFUSED: 'La requête a été refusée par le service (consignes de sécurité du modèle).',
  ERR_NETWORK: 'Problème de connexion réseau. Vérifiez votre connexion Internet.',
  ERR_TIMEOUT: "L'opération a dépassé le délai autorisé.",
  ERR_RESPONSE_EMPTY: 'Le service a renvoyé une réponse vide.',
  ERR_RESPONSE_INVALID: 'La réponse structurée du modèle est invalide ou incomplète.',
  ERR_VALIDATION: 'Certaines données sont invalides.',
  ERR_CONSENT_REQUIRED:
    'Le consentement de confidentialité doit être accepté dans Paramètres → Confidentialité & consentement avant de lancer une analyse.',
  ERR_STORAGE: "Échec de l'accès au stockage local.",
  ERR_DB_LOCKED: 'La base de données locale est verrouillée. Fermez les autres instances puis réessayez.',
  ERR_DB_CORRUPT: 'La base de données locale semble endommagée. Une restauration peut être nécessaire.',
  ERR_EXPORT: "L'export a échoué. Le rapport a été conservé localement.",
  ERR_CANCELLED: 'Opération annulée.',
  ERR_NOT_FOUND: 'Élément introuvable.',
  ERR_NOT_READY: "L'opération n'est pas prête pour l'instant.",
  ERR_ENCRYPTION_UNAVAILABLE:
    "Le chiffrement système n'est pas disponible : la clé API ne peut pas être protégée de façon sûre.",
  ERR_IMAGE_GENERATION_UNAVAILABLE:
    "La génération d'images n'est pas configurée ou indisponible. Un prompt de redesign complet a été préparé."
}

export interface AppErrorDetails {
  [key: string]: unknown
}

export class AppError extends Error {
  readonly code: AppErrorCode
  readonly userMessage: string
  readonly details: AppErrorDetails
  readonly retryable: boolean

  constructor(
    code: AppErrorCode,
    message?: string,
    options?: { details?: AppErrorDetails; cause?: unknown; retryable?: boolean }
  ) {
    super(message ?? code)
    this.name = 'AppError'
    this.code = code
    this.userMessage = USER_MESSAGES[code]
    this.details = options?.details ?? {}
    this.retryable = options?.retryable ?? false
    if (options?.cause !== undefined) {
      ;(this as { cause?: unknown }).cause = options.cause
    }
  }

  toJSON(): { code: AppErrorCode; message: string; userMessage: string; retryable: boolean } {
    return {
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      retryable: this.retryable
    }
  }
}

export function userMessageForCode(code: AppErrorCode): string {
  return USER_MESSAGES[code] ?? USER_MESSAGES.ERR_UNKNOWN
}

/** Convertit une erreur inconnue en AppError sans jamais exposer de secret. */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error
  if (error instanceof Error) {
    return new AppError('ERR_UNKNOWN', error.message, { cause: error })
  }
  return new AppError('ERR_UNKNOWN', String(error))
}

/** Sérialise une erreur pour traverser l'IPC de façon sûre. */
export function serializeError(error: unknown): {
  ok: false
  error: { code: AppErrorCode; userMessage: string; details?: AppErrorDetails; retryable: boolean }
} {
  const appError = toAppError(error)
  return {
    ok: false,
    error: {
      code: appError.code,
      userMessage: appError.userMessage,
      details: appError.details,
      retryable: appError.retryable
    }
  }
}
