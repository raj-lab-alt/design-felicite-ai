import { copyFileSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { AppError } from '@shared/errors'
import type { DiagnosticsDTO } from '@shared/ipc'
import type { DatabaseService } from '../db/DatabaseService'
import type { SecureStorageService } from './SecureStorageService'
import type { GeminiService } from '../gemini/GeminiService'
import { logger } from '../utils/logger'

export interface AppPaths {
  userDataPath: string
  dbPath: string
  logsPath: string
  mediaPath: string
  backupsPath: string
}

export class DiagnosticsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly secureStorage: SecureStorageService,
    private readonly gemini: GeminiService,
    private readonly paths: AppPaths
  ) {}

  get(): DiagnosticsDTO {
    const count = (table: string): number =>
      this.db.get<{ c: number }>(`SELECT COUNT(*) AS c FROM ${table}`)?.c ?? 0

    return {
      dbPath: this.paths.dbPath,
      dbSizeBytes: this.db.sizeBytes(),
      dbIntegrity: this.db.integrityCheck(),
      userDataPath: this.paths.userDataPath,
      logsPath: this.paths.logsPath,
      mediaPath: this.paths.mediaPath,
      backupsPath: this.paths.backupsPath,
      projectCount: count('projects'),
      imageCount: count('images'),
      analysisCount: count('analyses'),
      variantCount: count('variants'),
      encryptionAvailable: this.secureStorage.isEncryptionAvailable(),
      apiConfigured: this.gemini.isConfigured(),
      backupFiles: this.listBackups().map((b) => ({
        name: b.name,
        sizeBytes: b.sizeBytes,
        createdAt: b.createdAt
      }))
    }
  }

  backup(): { filePath: string } {
    const destination = this.db.defaultBackupName
    this.db.backupTo(destination)
    logger.info('Sauvegarde créée', { destination })
    return { filePath: destination }
  }

  restore(): void {
    const backups = this.listBackups()
    const latest = backups[0]
    if (!latest) throw new AppError('ERR_NOT_FOUND', 'Aucune sauvegarde disponible.')

    const source = join(this.paths.backupsPath, latest.name)
    const staging = `${source}.restore-tmp`
    copyFileSync(source, staging)
    this.db.close()
    try {
      copyFileSync(staging, this.paths.dbPath)
      this.db.open()
    } catch (error) {
      logger.error('Restauration échouée', { error: (error as Error).message })
      throw new AppError('ERR_DB_CORRUPT', 'Restauration impossible.', { cause: error })
    } finally {
      try {
        if (existsSync(staging)) rmSync(staging, { force: true })
      } catch {
        // ignore
      }
    }
    logger.info('Base restaurée', { from: source })
  }

  private listBackups(): Array<{ name: string; sizeBytes: number; createdAt: string }> {
    try {
      if (!existsSync(this.paths.backupsPath)) return []
      return readdirSync(this.paths.backupsPath)
        .filter((f) => f.endsWith('.db'))
        .map((name) => {
          const stats = statSync(join(this.paths.backupsPath, name))
          return { name, sizeBytes: stats.size, createdAt: stats.mtime.toISOString() }
        })
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    } catch {
      return []
    }
  }
}