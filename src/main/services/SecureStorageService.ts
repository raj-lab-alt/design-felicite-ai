import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { safeStorage } from 'electron'
import { AppError } from '@shared/errors'
import { maskApiKey } from '../gemini/keys'
import { logger } from '../utils/logger'

interface StoredCredential {
  mode: 'encrypted' | 'plain'
  value: string
}

/**
 * Plusieurs clés API peuvent être stockées, par ordre de priorité de bascule
 * (index 0 = clé principale). Chaque clé est chiffrée via safeStorage de façon
 * indépendante ; le mode « plain » n'est utilisé qu'en cas d'indisponibilité du
 * chiffrement système, explicitement signalé à l'utilisateur.
 */
interface CredentialsFile {
  /** Format historique (une seule clé) — migré automatiquement vers `apiKeys`. */
  apiKey?: StoredCredential
  apiKeys?: StoredCredential[]
}

export type StorageMode = 'encrypted' | 'unavailable' | 'none'

/**
 * Stockage local des identifiants Gemini.
 * - Les clés API ne sont JAMAIS écrites dans SQLite ni dans les logs.
 * - Chaque clé est chiffrée via safeStorage (DPAPI sur Windows) lorsque disponible.
 * - Si le chiffrement système est indisponible, la clé est stockée en clair
 *   avec un mode explicitement signalé (jamais silencieux).
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

  /** Fichier historique `apiKey` migré en tête de la liste, puis supprimé. */
  private normalize(file: CredentialsFile): CredentialsFile {
    const keys = Array.isArray(file.apiKeys) ? file.apiKeys.slice() : []
    if (file.apiKey && file.apiKey.value) {
      keys.unshift(file.apiKey)
      delete file.apiKey
    }
    file.apiKeys = keys
    return file
  }

  private decrypt(cred: StoredCredential): string | null {
    try {
      if (cred.mode === 'encrypted') return safeStorage.decryptString(Buffer.from(cred.value, 'base64'))
      return Buffer.from(cred.value, 'base64').toString('utf8')
    } catch (error) {
      logger.error('Déchiffrement d’une clé API impossible', { error: (error as Error).message })
      return null
    }
  }

  private encryptOrThrow(key: string): StoredCredential {
    if (!this.isEncryptionAvailable()) {
      throw new AppError('ERR_ENCRYPTION_UNAVAILABLE', undefined, {
        details: { reason: 'safeStorage indisponible' }
      })
    }
    try {
      const encrypted = safeStorage.encryptString(key)
      return { mode: 'encrypted', value: encrypted.toString('base64') }
    } catch (error) {
      logger.warn('Chiffrement safeStorage échoué', { error: (error as Error).message })
      throw new AppError('ERR_ENCRYPTION_UNAVAILABLE', undefined, {
        details: { reason: 'chiffrement échoué' },
        cause: error
      })
    }
  }

  isEncryptionAvailable(): boolean {
    try {
      return safeStorage.isEncryptionAvailable()
    } catch {
      return false
    }
  }

  /** Déchiffre toutes les clés, dans l'ordre de priorité (index 0 = principale). */
  getApiKeys(): string[] {
    const file = this.normalize(this.readFile())
    const keys: string[] = []
    for (const cred of file.apiKeys ?? []) {
      const decrypted = this.decrypt(cred)
      if (decrypted) keys.push(decrypted)
    }
    return keys
  }

  /** Rétrocompatibilité : première clé configurée. */
  getApiKey(): string | null {
    return this.getApiKeys()[0] ?? null
  }

  hasKey(): boolean {
    return this.getApiKeys().length > 0
  }

  keyCount(): number {
    return this.getApiKeys().length
  }

  /** Aperçu masqué des clés destiné au renderer (jamais la clé complète). */
  maskedKeys(): string[] {
    return this.getApiKeys().map((key) => maskApiKey(key))
  }

  storageMode(): StorageMode {
    const file = this.normalize(this.readFile())
    const first = file.apiKeys?.[0]
    if (!first || !first.value) return 'none'
    return first.mode === 'encrypted' ? 'encrypted' : 'unavailable'
  }

  private assertKeyLength(key: string): string {
    const trimmed = key.trim()
    if (trimmed.length < 10) {
      throw new AppError('ERR_VALIDATION', 'La clé API semble trop courte.')
    }
    return trimmed
  }

  /**
   * Ajoute une clé API (chiffrée). Si la clé existe déjà, sa position est
   * conservée et rien n'est dupliqué. Laisse la clé en tête si aucune n'existe.
   */
  setApiKey(apiKey: string): void {
    const file = this.normalize(this.readFile())
    const key = this.assertKeyLength(apiKey)
    const keys = file.apiKeys ?? []
    if (keys.some((cred) => this.decrypt(cred) === key)) return
    keys.push(this.encryptOrThrow(key))
    file.apiKeys = keys
    this.writeFile(file)
  }

  /** Ajoute une clé en clair (mode dégradé, décision utilisateur explicite). */
  setApiKeyPlain(apiKey: string): void {
    const file = this.normalize(this.readFile())
    const key = this.assertKeyLength(apiKey)
    const keys = file.apiKeys ?? []
    if (keys.some((cred) => this.decrypt(cred) === key)) return
    keys.push({ mode: 'plain', value: Buffer.from(key, 'utf8').toString('base64') })
    file.apiKeys = keys
    this.writeFile(file)
  }

  /** Retire la clé à l'index donné (index 0 = principale). */
  removeApiKey(index: number): void {
    const file = this.normalize(this.readFile())
    const keys = file.apiKeys ?? []
    if (!Number.isInteger(index) || index < 0 || index >= keys.length) {
      throw new AppError('ERR_VALIDATION', 'Index de clé API invalide.')
    }
    keys.splice(index, 1)
    file.apiKeys = keys
    this.writeFile(file)
  }

  /** Déplace la clé à l'index donné en tête de liste (devient la principale). */
  prioritizeApiKey(index: number): void {
    const file = this.normalize(this.readFile())
    const keys = file.apiKeys ?? []
    if (!Number.isInteger(index) || index < 0 || index >= keys.length) {
      throw new AppError('ERR_VALIDATION', 'Index de clé API invalide.')
    }
    if (index === 0) return
    const [cred] = keys.splice(index, 1)
    keys.unshift(cred)
    file.apiKeys = keys
    this.writeFile(file)
  }

  deleteApiKey(): void {
    try {
      if (existsSync(this.credentialsPath)) rmSync(this.credentialsPath, { force: true })
    } catch (error) {
      logger.warn('Suppression du fichier d’identifiants impossible', { error: (error as Error).message })
    }
  }
}