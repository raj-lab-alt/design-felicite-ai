import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { safeStorage } from 'electron'
import { AppError } from '@shared/errors'
import { logger } from '../utils/logger'

interface StoredCredential {
  mode: 'encrypted' | 'plain'
  value: string
}

interface CredentialsFile {
  apiKey?: StoredCredential
}

export type StorageMode = 'encrypted' | 'unavailable' | 'none'

/**
 * Stockage local des identifiants Gemini.
 * - La clé API n'est JAMAIS écrite dans SQLite ni dans les logs.
 * - Elle est chiffrée via safeStorage (DPAPI sur Windows) lorsque disponible.
 * - Si le chiffrement système est indisponible, la clé est stockée en clair
 *   avec un mode explicitement signalé à l'utilisateur (jamais silencieux).
 */
export class SecureStorageService {
  constructor(private readonly credentialsPath: string) {}

  private readFile(): CredentialsFile {
    try {
      if (!existsSync(this.credentialsPath)) return {}
      const raw = readFileSync(this.credentialsPath, 'utf8')
      const parsed = JSON.parse(raw) as CredentialsFile
      return parsed ?? {}
    } catch (error) {
      logger.warn('Lecture du fichier d’identifiants impossible', { error: (error as Error).message })
      return {}
    }
  }

  private writeFile(data: CredentialsFile): void {
    mkdirSync(dirname(this.credentialsPath), { recursive: true })
    writeFileSync(this.credentialsPath, JSON.stringify(data), { encoding: 'utf8', mode: 0o600 })
  }

  isEncryptionAvailable(): boolean {
    try {
      return safeStorage.isEncryptionAvailable()
    } catch {
      return false
    }
  }

  hasKey(): boolean {
    const file = this.readFile()
    return Boolean(file.apiKey && file.apiKey.value)
  }

  storageMode(): StorageMode {
    const file = this.readFile()
    if (!file.apiKey || !file.apiKey.value) return 'none'
    return file.apiKey.mode === 'encrypted' ? 'encrypted' : 'unavailable'
  }

  setApiKey(apiKey: string): void {
    const trimmed = apiKey.trim()
    if (trimmed.length < 10) {
      throw new AppError('ERR_VALIDATION', 'La clé API semble trop courte.')
    }
    const available = this.isEncryptionAvailable()
    let credential: StoredCredential
    if (available) {
      try {
        const encrypted = safeStorage.encryptString(trimmed)
        credential = { mode: 'encrypted', value: encrypted.toString('base64') }
      } catch (error) {
        logger.warn('Chiffrement safeStorage échoué, stockage en clair signalé', {
          error: (error as Error).message
        })
        credential = { mode: 'plain', value: Buffer.from(trimmed, 'utf8').toString('base64') }
      }
    } else {
      throw new AppError('ERR_ENCRYPTION_UNAVAILABLE', undefined, {
        details: { reason: 'safeStorage indisponible' }
      })
    }
    const file = this.readFile()
    file.apiKey = credential
    this.writeFile(file)
  }

  /** Autorise explicitement le stockage en clair (mode dégradé, décision utilisateur). */
  setApiKeyPlain(apiKey: string): void {
    const trimmed = apiKey.trim()
    if (trimmed.length < 10) {
      throw new AppError('ERR_VALIDATION', 'La clé API semble trop courte.')
    }
    const file = this.readFile()
    file.apiKey = { mode: 'plain', value: Buffer.from(trimmed, 'utf8').toString('base64') }
    this.writeFile(file)
  }

  /** Usage interne uniquement : ne jamais écrire la valeur retournée dans un log ou une réponse IPC. */
  getApiKey(): string | null {
    const file = this.readFile()
    if (!file.apiKey || !file.apiKey.value) return null
    try {
      if (file.apiKey.mode === 'encrypted') {
        return safeStorage.decryptString(Buffer.from(file.apiKey.value, 'base64'))
      }
      return Buffer.from(file.apiKey.value, 'base64').toString('utf8')
    } catch (error) {
      logger.error('Déchiffrement de la clé API impossible', { error: (error as Error).message })
      return null
    }
  }

  deleteApiKey(): void {
    try {
      if (existsSync(this.credentialsPath)) rmSync(this.credentialsPath, { force: true })
    } catch (error) {
      logger.warn('Suppression du fichier d’identifiants impossible', { error: (error as Error).message })
    }
  }
}
