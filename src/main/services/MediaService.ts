import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, extname, join, normalize, resolve } from 'node:path'
import { AppError } from '@shared/errors'
import { IMAGE_LIMITS, ACCEPTED_IMAGE_EXTENSIONS } from '@shared/constants'
import type { ImageDTO, ImageRole } from '@shared/ipc'
import type { DatabaseService } from '../db/DatabaseService'
import { detectImageMeta, extensionForMime } from '../utils/imageMeta'
import { newId, nowIso, sha256Hex } from '../utils/ids'
import { logger } from '../utils/logger'

interface ImageRow {
  id: string
  project_id: string
  file_name: string
  file_path: string
  mime_type: string
  width: number
  height: number
  size_bytes: number
  sha256: string
  role: string
  created_at: string
}

export class MediaService {
  constructor(
    private readonly db: DatabaseService,
    private readonly mediaRoot: string
  ) {}

  private projectDir(projectId: string): string {
    return resolve(this.mediaRoot, projectId)
  }

  validateFile(filePath: string): { buffer: Buffer; mimeType: string; width: number; height: number } {
    if (!existsSync(filePath)) {
      throw new AppError('ERR_IMAGE_INVALID', `Fichier introuvable : ${basename(filePath)}`)
    }
    const ext = extname(filePath).toLowerCase()
    if (!ACCEPTED_IMAGE_EXTENSIONS.includes(ext)) {
      throw new AppError('ERR_IMAGE_UNSUPPORTED_FORMAT', `Extension non supportée : ${ext}`)
    }
    const stats = statSync(filePath)
    if (stats.size > IMAGE_LIMITS.maxBytes) {
      throw new AppError('ERR_IMAGE_TOO_LARGE', `Image supérieure à ${Math.round(IMAGE_LIMITS.maxBytes / 1024 / 1024)} Mo`)
    }
    if (stats.size === 0) {
      throw new AppError('ERR_IMAGE_INVALID', 'Fichier vide.')
    }
    const buffer = readFileSync(filePath)
    const meta = detectImageMeta(buffer)
    if (!meta) {
      throw new AppError('ERR_IMAGE_DECODE', `Impossible de décoder l’image : ${basename(filePath)}`)
    }
    if (meta.width > IMAGE_LIMITS.maxPixelsPerSide || meta.height > IMAGE_LIMITS.maxPixelsPerSide) {
      throw new AppError('ERR_IMAGE_INVALID', `Dimensions trop grandes (${meta.width}×${meta.height}).`)
    }
    return { buffer, mimeType: meta.mimeType, width: meta.width, height: meta.height }
  }

  importFromPaths(projectId: string, filePaths: string[]): ImageDTO[] {
    const project = this.db.get<{ id: string }>(`SELECT id FROM projects WHERE id = ?`, [projectId])
    if (!project) throw new AppError('ERR_NOT_FOUND', 'Projet introuvable.')
    if (filePaths.length === 0) throw new AppError('ERR_IMAGE_INVALID', 'Aucun fichier sélectionné.')

    const imported: ImageDTO[] = []
    const dir = this.projectDir(projectId)
    mkdirSync(dir, { recursive: true })

    for (const filePath of filePaths) {
      const { buffer, mimeType, width, height } = this.validateFile(filePath)
      const id = newId('img')
      const safeExt = extensionForMime(mimeType)
      const destPath = join(dir, `${id}${safeExt}`)
      // Empêche toute écriture hors du dossier média du projet.
      if (!normalize(destPath).startsWith(normalize(dir))) {
        throw new AppError('ERR_IMAGE_INVALID', 'Chemin de destination invalide.')
      }
      writeFileSync(destPath, buffer)
      const sha = sha256Hex(buffer)
      const now = nowIso()
      this.db.run(
        `INSERT INTO images (id, project_id, file_name, file_path, mime_type, width, height, size_bytes, sha256, role, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, projectId, basename(filePath), destPath, mimeType, width, height, buffer.length, sha, 'original', now]
      )
      this.db.run(`UPDATE projects SET updated_at = ? WHERE id = ?`, [now, projectId])
      imported.push({
        id,
        projectId,
        fileName: basename(filePath),
        filePath: destPath,
        mimeType,
        width,
        height,
        sizeBytes: buffer.length,
        sha256: sha,
        role: 'original',
        createdAt: now
      })
      logger.info('Image importée', { projectId, imageId: id, width, height, bytes: buffer.length })
    }
    return imported
  }

  /** Enregistre une image générée (buffer) dans le stockage du projet. */
  saveGeneratedImage(
    projectId: string,
    buffer: Buffer,
    fileName: string,
    role: ImageRole = 'generated'
  ): ImageDTO {
    const meta = detectImageMeta(buffer)
    if (!meta) throw new AppError('ERR_IMAGE_DECODE', 'Image générée non décodable.')
    const dir = this.projectDir(projectId)
    mkdirSync(dir, { recursive: true })
    const id = newId('img')
    const destPath = join(dir, `${id}${extensionForMime(meta.mimeType)}`)
    if (!normalize(destPath).startsWith(normalize(dir))) {
      throw new AppError('ERR_STORAGE', 'Chemin de destination invalide.')
    }
    writeFileSync(destPath, buffer)
    const sha = sha256Hex(buffer)
    const now = nowIso()
    this.db.run(
      `INSERT INTO images (id, project_id, file_name, file_path, mime_type, width, height, size_bytes, sha256, role, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, projectId, fileName, destPath, meta.mimeType, meta.width, meta.height, buffer.length, sha, role, now]
    )
    return {
      id,
      projectId,
      fileName,
      filePath: destPath,
      mimeType: meta.mimeType,
      width: meta.width,
      height: meta.height,
      sizeBytes: buffer.length,
      sha256: sha,
      role,
      createdAt: now
    }
  }

  getById(imageId: string): ImageDTO | null {
    const row = this.db.get<ImageRow>(`SELECT * FROM images WHERE id = ?`, [imageId])
    return row ? this.mapRow(row) : null
  }

  listByProject(projectId: string): ImageDTO[] {
    const rows = this.db.all<ImageRow>(`SELECT * FROM images WHERE project_id = ? ORDER BY created_at ASC`, [
      projectId
    ])
    return rows.map((r) => this.mapRow(r))
  }

  readFile(imageId: string): Buffer {
    const image = this.getById(imageId)
    if (!image) throw new AppError('ERR_NOT_FOUND', 'Image introuvable.')
    if (!existsSync(image.filePath)) throw new AppError('ERR_IMAGE_INVALID', 'Fichier image manquant sur le disque.')
    return readFileSync(image.filePath)
  }

  remove(imageId: string): void {
    const image = this.getById(imageId)
    if (!image) return
    this.db.run(`DELETE FROM images WHERE id = ?`, [imageId])
    this.safeDeleteFile(image.filePath)
    logger.info('Image supprimée', { imageId })
  }

  /** Supprime l'intégralité du dossier média d'un projet (appelé après suppression en base). */
  removeProjectMedia(projectId: string): void {
    const dir = this.projectDir(projectId)
    const root = normalize(resolve(this.mediaRoot))
    const target = normalize(resolve(dir))
    if (!target.startsWith(root)) {
      logger.warn('Suppression de dossier média refusée (hors racine)', { projectId })
      return
    }
    try {
      if (existsSync(target)) rmSync(target, { recursive: true, force: true })
    } catch (error) {
      logger.warn('Suppression du dossier média impossible', { error: (error as Error).message })
    }
  }

  private safeDeleteFile(filePath: string): void {
    const root = normalize(resolve(this.mediaRoot))
    const target = normalize(resolve(filePath))
    if (!target.startsWith(root)) {
      logger.warn('Suppression refusée hors du dossier média', { filePath })
      return
    }
    try {
      if (existsSync(target)) rmSync(target, { force: true })
    } catch (error) {
      logger.warn('Suppression de fichier impossible', { error: (error as Error).message })
    }
  }

  private mapRow(row: ImageRow): ImageDTO {
    return {
      id: row.id,
      projectId: row.project_id,
      fileName: row.file_name,
      filePath: row.file_path,
      mimeType: row.mime_type,
      width: row.width,
      height: row.height,
      sizeBytes: row.size_bytes,
      sha256: row.sha256,
      role: row.role as ImageRole,
      createdAt: row.created_at
    }
  }
}
