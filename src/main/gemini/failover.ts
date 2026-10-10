import { AppError, toAppError } from '@shared/errors'
import { canSwitchKey, canSwitchModel } from './errors'

export interface FailoverAttempt {
  keyIndex: number
  model: string
  errorCode: string
}

export interface FailoverOutcome<T> {
  result: T
  keyIndex: number
  model: string
  attempts: number
  usedFallback: boolean
  attemptsLog: FailoverAttempt[]
}

/**
 * Exécute un appel en basculant automatiquement entre les clés API (externe)
 * et les modèles (interne) jusqu'à obtenir un succès.
 *
 * - Erreur liée à la clé (clé refusée, quota épuisé, débit limité) →
 *   essai avec la clé suivante, en repartant du modèle principal.
 * - Erreur liée au modèle (modèle indisponible, panne, délai, réponse vide) →
 *   essai avec le modèle suivant, sur la même clé.
 * - Erreur définitive (validation, requête refusée, annulation…) → remontée immédiate.
 *
 * En cas d'échec général, la dernière erreur est remontée enrichie du nombre
 * de tentatives (aucun secret dans les détails).
 */
export async function runWithFailover<T>(params: {
  keysLen: number
  /** Modèles par ordre de préférence (premier = principal). */
  models: string[]
  /** Index de clé de départ (préféré), borné par l'appelant. */
  startKeyIndex: number
  attempt: (keyIndex: number, model: string) => Promise<T>
  isAborted?: () => boolean
}): Promise<FailoverOutcome<T>> {
  const { keysLen, models, startKeyIndex, attempt, isAborted } = params

  if (keysLen <= 0) {
    throw new AppError('ERR_API_NOT_CONFIGURED')
  }
  const modelList = models.filter((m) => m && m.trim().length > 0)
  if (modelList.length === 0) {
    throw new AppError('ERR_VALIDATION', 'Aucun modèle configuré pour cet appel.')
  }

  const attemptsLog: FailoverAttempt[] = []
  let lastError: AppError | null = null

  for (let keyStep = 0; keyStep < keysLen; keyStep += 1) {
    const keyIndex = (startKeyIndex + keyStep) % keysLen

    for (const model of modelList) {
      if (isAborted?.()) {
        throw new AppError('ERR_CANCELLED')
      }
      try {
        const result = await attempt(keyIndex, model)
        return {
          result,
          keyIndex,
          model,
          attempts: attemptsLog.length + 1,
          usedFallback: attemptsLog.length > 0,
          attemptsLog
        }
      } catch (error) {
        const appError = toAppError(error)
        attemptsLog.push({ keyIndex, model, errorCode: appError.code })
        if (appError.code === 'ERR_CANCELLED') throw appError

        const switchKey = canSwitchKey(appError.code)
        const switchModel = canSwitchModel(appError.code)
        if (!switchKey && !switchModel) throw appError

        lastError = appError
        // Si seule une bascule de modèle suffit, on reste sur la même clé.
        if (!switchKey) continue
        // Sinon : la clé est en cause, on passe à la suivante (modèles repartis du principal).
        break
      }
    }
  }

  const error = lastError ?? new AppError('ERR_UNKNOWN')
  throw new AppError(error.code, error.message, {
    details: {
      ...error.details,
      failoverAttempts: attemptsLog.length
    },
    cause: error,
    retryable: error.retryable
  })
}