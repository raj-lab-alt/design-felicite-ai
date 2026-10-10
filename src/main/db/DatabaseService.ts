import { Database } from 'node-sqlite3-wasm'
import { existsSync, mkdirSync, statSync, copyFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { AppError } from '@shared/errors'
import { logger } from '../utils/logger'
import { MIGRATIONS } from './migrations'

export type SqlValue = string | number | null | Uint8Array

export interface RunResult {
  changes: number
  lastInsertRowid: number
}

/**
 * Service d'accès à la base SQLite locale.
 * Utilise node-sqlite3-wasm : aucun module natif, aucune compilation requise.
 * Toutes les écritures passent par des requêtes paramétrées.
 */
export class DatabaseService {
  private db: Database | null = null
  private closed = false

  constructor(private readonly dbPath: string) {}

  get path(): string {
    return this.dbPath
  }

  open(): void {
    if (this.db) return
    try {
      mkdirSync(dirname(this.dbPath), { recursive: true })
      this.db = new Database(this.dbPath)
      this.db.exec('PRAGMA foreign_keys = ON;')
      this.db.exec('PRAGMA journal_mode = WAL;')
      this.db.exec('PRAGMA synchronous = NORMAL;')
      this.closed = false
      this.runMigrations()
    } catch (error) {
      logger.error('Échec ouverture base de données', { error: (error as Error).message, path: this.dbPath })
      throw new AppError('ERR_STORAGE', `Ouverture de la base impossible : ${(error as Error).message}`, {
        cause: error
      })
    }
  }

  private ensure(): Database {
    if (!this.db) this.open()
    if (!this.db) throw new AppError('ERR_STORAGE', 'Base de données non initialisée')
    return this.db
  }

  exec(sql: string): void {
    this.ensure().exec(sql)
  }

  run(sql: string, params: SqlValue[] = []): RunResult {
    try {
      const info = this.ensure().run(sql, params)
      const lastId =
        typeof info.lastInsertRowid === 'bigint'
          ? Number(info.lastInsertRowid)
          : Number(info.lastInsertRowid ?? 0)
      return { changes: Number(info.changes ?? 0), lastInsertRowid: lastId }
    } catch (error) {
      throw this.mapError(error)
    }
  }

  get<T = Record<string, unknown>>(sql: string, params: SqlValue[] = []): T | undefined {
    try {
      const row = this.ensure().get(sql, params)
      return (row as T) ?? undefined
    } catch (error) {
      throw this.mapError(error)
    }
  }

  all<T = Record<string, unknown>>(sql: string, params: SqlValue[] = []): T[] {
    try {
      return this.ensure().all(sql, params) as T[]
    } catch (error) {
      throw this.mapError(error)
    }
  }

  private mapError(error: unknown): AppError {
    const message = error instanceof Error ? error.message : String(error)
    if (/lock|busy/i.test(message)) {
      return new AppError('ERR_DB_LOCKED', message, { cause: error })
    }
    if (/malformed|corrupt|not a database/i.test(message)) {
      return new AppError('ERR_DB_CORRUPT', message, { cause: error })
    }
    return new AppError('ERR_STORAGE', message, { cause: error })
  }

  /** Exécute fn dans une transaction ; réutilise la transaction englobante si imbriquée. */
  transaction<T>(fn: () => T): T {
    const db = this.ensure()
    if (db.inTransaction) {
      return fn()
    }
    db.exec('BEGIN IMMEDIATE;')
    try {
      const result = fn()
      db.exec('COMMIT;')
      return result
    } catch (error) {
      try {
        db.exec('ROLLBACK;')
      } catch {
        // ignore
      }
      throw error
    }
  }

  private runMigrations(): void {
    const db = this.ensure()
    db.exec(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);`)
    const row = db.get(`SELECT value FROM meta WHERE key = ?`, ['schema_version']) as
      | { value: string }
      | undefined
    const current = row ? Number(row.value) : 0

    for (const migration of MIGRATIONS) {
      if (migration.version <= current) continue
      logger.info(`Application migration ${migration.version} (${migration.name})`)
      db.exec('BEGIN IMMEDIATE;')
      try {
        for (const statement of migration.statements) {
          db.exec(statement)
        }
        db.run(`INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)`, [
          'schema_version',
          String(migration.version)
        ])
        db.exec('COMMIT;')
      } catch (error) {
        try {
          db.exec('ROLLBACK;')
        } catch {
          // ignore
        }
        throw new AppError('ERR_STORAGE', `Migration ${migration.version} échouée : ${(error as Error).message}`, {
          cause: error
        })
      }
    }
  }

  getSchemaVersion(): number {
    const row = this.get<{ value: string }>(`SELECT value FROM meta WHERE key = ?`, ['schema_version'])
    return row ? Number(row.value) : 0
  }

  integrityCheck(): 'ok' | 'error' | 'unknown' {
    try {
      const rows = this.all<{ integrity_check: string }>('PRAGMA integrity_check;')
      if (rows.length === 1 && rows[0].integrity_check === 'ok') return 'ok'
      return 'error'
    } catch {
      return 'unknown'
    }
  }

  sizeBytes(): number {
    try {
      return existsSync(this.dbPath) ? statSync(this.dbPath).size : 0
    } catch {
      return 0
    }
  }

  /** Sauvegarde cohérente via une copie du fichier. À appeler quand aucune écriture n'est en cours. */
  backupTo(destination: string): void {
    const db = this.ensure()
    mkdirSync(dirname(destination), { recursive: true })
    try {
      // VACUUM INTO produit un fichier de sauvegarde cohérent.
      const escaped = destination.replace(/'/g, "''")
      db.exec(`VACUUM INTO '${escaped}';`)
    } catch (error) {
      logger.warn('VACUUM INTO indisponible, repli sur copie de fichier', {
        error: (error as Error).message
      })
      this.close()
      copyFileSync(this.dbPath, destination)
      this.open()
    }
  }

  close(): void {
    if (this.db && !this.closed) {
      try {
        this.db.close()
      } catch {
        // ignore
      }
      this.closed = true
      this.db = null
    }
  }

  get defaultBackupName(): string {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    return join(dirname(this.dbPath), '..', 'backups', `design-felicite-${stamp}.db`)
  }
}
