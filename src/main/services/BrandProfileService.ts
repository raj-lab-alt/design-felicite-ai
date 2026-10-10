import { AppError } from '@shared/errors'
import { brandProfileInputSchema, type BrandProfile, type BrandProfileInput } from '@shared/schemas'
import type { DatabaseService } from '../db/DatabaseService'
import { newId, nowIso } from '../utils/ids'

interface ProfileRow {
  id: string
  name: string
  data: string
  created_at: string
  updated_at: string
}

export class BrandProfileService {
  constructor(private readonly db: DatabaseService) {}

  list(): BrandProfile[] {
    const rows = this.db.all<ProfileRow>(`SELECT * FROM brand_profiles ORDER BY updated_at DESC`)
    return rows.map((r) => this.mapRow(r))
  }

  get(id: string): BrandProfile | null {
    const row = this.db.get<ProfileRow>(`SELECT * FROM brand_profiles WHERE id = ?`, [id])
    return row ? this.mapRow(row) : null
  }

  create(input: BrandProfileInput): BrandProfile {
    const data = brandProfileInputSchema.parse(input)
    const id = newId('brand')
    const now = nowIso()
    this.db.run(
      `INSERT INTO brand_profiles (id, name, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      [id, data.name, JSON.stringify(data), now, now]
    )
    return this.get(id) as BrandProfile
  }

  update(id: string, input: BrandProfileInput): BrandProfile {
    const existing = this.get(id)
    if (!existing) throw new AppError('ERR_NOT_FOUND', 'Profil de marque introuvable.')
    const data = brandProfileInputSchema.parse(input)
    this.db.run(`UPDATE brand_profiles SET name = ?, data = ?, updated_at = ? WHERE id = ?`, [
      data.name,
      JSON.stringify(data),
      nowIso(),
      id
    ])
    return this.get(id) as BrandProfile
  }

  delete(id: string): void {
    const existing = this.get(id)
    if (!existing) throw new AppError('ERR_NOT_FOUND', 'Profil de marque introuvable.')
    this.db.run(`DELETE FROM brand_profiles WHERE id = ?`, [id])
  }

  private mapRow(row: ProfileRow): BrandProfile {
    const data = brandProfileInputSchema.parse(JSON.parse(row.data))
    return { ...data, id: row.id, createdAt: row.created_at, updatedAt: row.updated_at }
  }
}
