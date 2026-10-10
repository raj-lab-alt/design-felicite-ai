import { appSettingsSchema, appSettingsPatchSchema, type AppSettings, type AppSettingsPatch } from '@shared/schemas'
import type { DatabaseService } from '../db/DatabaseService'
import { nowIso } from '../utils/ids'

const SETTINGS_KEY = 'app'

export class SettingsService {
  constructor(private readonly db: DatabaseService) {}

  get(): AppSettings {
    const row = this.db.get<{ value: string }>(`SELECT value FROM settings WHERE key = ?`, [SETTINGS_KEY])
    if (!row) {
      const defaults = appSettingsSchema.parse({})
      this.save(defaults)
      return defaults
    }
    try {
      const parsed = JSON.parse(row.value)
      return appSettingsSchema.parse(parsed)
    } catch {
      const defaults = appSettingsSchema.parse({})
      this.save(defaults)
      return defaults
    }
  }

  update(patch: AppSettingsPatch): AppSettings {
    const patchValidated = appSettingsPatchSchema.parse(patch)
    const merged = appSettingsSchema.parse({ ...this.get(), ...patchValidated })
    this.save(merged)
    return merged
  }

  private save(settings: AppSettings): void {
    this.db.run(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [SETTINGS_KEY, JSON.stringify(settings), nowIso()]
    )
  }
}
