import type { UsageSummaryDTO } from '@shared/ipc'
import type { DatabaseService } from '../db/DatabaseService'

interface UsageRow {
  usage_json: string | null
}

/**
 * Cumul de consommation à partir des rapports persistés.
 * Les coûts sont des estimations locales (tarifs paramétrés), jamais facturés.
 */
export class UsageService {
  constructor(private readonly db: DatabaseService) {}

  summary(): UsageSummaryDTO {
    const rows = this.db.all<UsageRow>(`SELECT usage_json FROM analysis_results ORDER BY created_at DESC`)
    const parsed = rows
      .map((r) => {
        if (!r.usage_json) return null
        try {
          const json = JSON.parse(r.usage_json) as {
            promptTokens?: number | null
            outputTokens?: number | null
            totalTokens?: number | null
            estimatedCostUsd?: number | null
          }
          return {
            promptTokens: json.promptTokens ?? null,
            outputTokens: json.outputTokens ?? null,
            totalTokens: json.totalTokens ?? null,
            estimatedCostUsd: typeof json.estimatedCostUsd === 'number' ? json.estimatedCostUsd : null
          }
        } catch {
          return null
        }
      })
      .filter((u): u is NonNullable<typeof u> => u !== null)

    const last = parsed[0] ?? null
    const estimatedCostUsd = parsed.reduce((sum, u) => sum + (u.estimatedCostUsd ?? 0), 0)

    return {
      analysisCount: parsed.length,
      estimatedCostUsd,
      lastUsage: last
    }
  }
}