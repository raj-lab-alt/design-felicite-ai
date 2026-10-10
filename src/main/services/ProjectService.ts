import { AppError } from '@shared/errors'
import type { CreateProject, UpdateProject } from '@shared/schemas'
import type { ProjectDTO } from '@shared/ipc'
import type { DatabaseService } from '../db/DatabaseService'
import { newId, nowIso, toSqliteBool } from '../utils/ids'
import { logger } from '../utils/logger'

interface ProjectRow {
  id: string
  name: string
  brand_profile_id: string | null
  favorite: number
  archived: number
  created_at: string
  updated_at: string
}

interface ProjectCountsRow {
  id: string
  image_count: number
  analysis_count: number
  variant_count: number
}

export class ProjectService {
  constructor(private readonly db: DatabaseService) {}

  create(input: CreateProject): ProjectDTO {
    const id = newId('proj')
    const now = nowIso()
    this.db.run(
      `INSERT INTO projects (id, name, brand_profile_id, favorite, archived, created_at, updated_at)
       VALUES (?, ?, ?, 0, 0, ?, ?)`,
      [id, input.name, input.brandProfileId ?? null, now, now]
    )
    logger.info('Projet créé', { projectId: id, name: input.name })
    return this.get(id)
  }

  get(id: string): ProjectDTO {
    const row = this.db.get<ProjectRow>(`SELECT * FROM projects WHERE id = ?`, [id])
    if (!row) throw new AppError('ERR_NOT_FOUND', 'Projet introuvable.')
    return this.mapRow(row)
  }

  list(opts?: { includeArchived?: boolean }): ProjectDTO[] {
    const sql = opts?.includeArchived
      ? `SELECT * FROM projects ORDER BY updated_at DESC`
      : `SELECT * FROM projects WHERE archived = 0 ORDER BY updated_at DESC`
    const rows = this.db.all<ProjectRow>(sql)
    return rows.map((r) => this.mapRow(r))
  }

  recent(limit = 6): ProjectDTO[] {
    const rows = this.db.all<ProjectRow>(
      `SELECT * FROM projects WHERE archived = 0 ORDER BY updated_at DESC LIMIT ?`,
      [limit]
    )
    return rows.map((r) => this.mapRow(r))
  }

  update(patch: UpdateProject): ProjectDTO {
    const existing = this.get(patch.id)
    const name = patch.name ?? existing.name
    const brandProfileId = patch.brandProfileId !== undefined ? patch.brandProfileId : existing.brandProfileId
    const favorite = patch.favorite !== undefined ? patch.favorite : existing.favorite
    const archived = patch.archived !== undefined ? patch.archived : existing.archived
    const now = nowIso()
    this.db.run(
      `UPDATE projects SET name = ?, brand_profile_id = ?, favorite = ?, archived = ?, updated_at = ? WHERE id = ?`,
      [name, brandProfileId, toSqliteBool(favorite), toSqliteBool(archived), now, patch.id]
    )
    return this.get(patch.id)
  }

  /**
   * Suppression d'un projet (confirmation gérée côté IPC).
   * Supprime les lignes en base ; le nettoyage des fichiers média du projet est
   * assuré par MediaService.removeProjectMedia côté handler.
   */
  delete(id: string): void {
    const project = this.get(id)
    this.db.run(`DELETE FROM projects WHERE id = ?`, [id])
    logger.info('Projet supprimé', { projectId: id, name: project.name })
  }

  has(id: string): boolean {
    return Boolean(this.db.get<{ id: string }>(`SELECT id FROM projects WHERE id = ?`, [id]))
  }

  search(query: string): ProjectDTO[] {
    if (!query.trim()) return this.list()
    const like = `%${query.trim()}%`
    const rows = this.db.all<ProjectRow>(
      `SELECT * FROM projects WHERE archived = 0 AND name LIKE ? ORDER BY updated_at DESC`,
      [like]
    )
    return rows.map((r) => this.mapRow(r))
  }

  private mapRow(row: ProjectRow): ProjectDTO {
    const counts = this.db.get<ProjectCountsRow>(
      `SELECT
         p.id,
         (SELECT COUNT(*) FROM images i WHERE i.project_id = p.id) AS image_count,
         (SELECT COUNT(*) FROM analyses a WHERE a.project_id = p.id) AS analysis_count,
         (SELECT COUNT(*) FROM variants v WHERE v.project_id = p.id) AS variant_count
       FROM projects p WHERE p.id = ?`,
      [row.id]
    )
    return {
      id: row.id,
      name: row.name,
      brandProfileId: row.brand_profile_id,
      favorite: row.favorite === 1,
      archived: row.archived === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      imageCount: counts?.image_count ?? 0,
      analysisCount: counts?.analysis_count ?? 0,
      variantCount: counts?.variant_count ?? 0
    }
  }
}