import type { IpcResult } from '@shared/ipc'

/** Erreur applicative transportée depuis le processus principal à travers l'IPC. */
export class ApiError extends Error {
  readonly code: string
  readonly userMessage: string
  readonly details: Record<string, unknown> | undefined
  readonly retryable: boolean

  constructor(error: {
    code: string
    userMessage: string
    details?: Record<string, unknown>
    retryable: boolean
  }) {
    super(error.userMessage)
    this.name = 'ApiError'
    this.code = error.code
    this.userMessage = error.userMessage
    this.details = error.details
    this.retryable = error.retryable
  }
}

/** Déballer un résultat de type IpcResult ; lève ApiError en cas d'échec. */
export function unwrap<T>(result: IpcResult<T>): T {
  if (!result.ok) throw new ApiError(result.error)
  return result.data
}

/** Exécute un appel IPC (promesse de la surface window.api) et déballе le résultat. */
export async function call<T>(promise: Promise<IpcResult<T>>): Promise<T> {
  return unwrap(await promise)
}

/** URL du fichier média d'une image via le schéma protocole `media:` (déclaré dans le main). */
export function mediaUrl(imageId: string): string {
  return `media://image/${encodeURIComponent(imageId)}`
}