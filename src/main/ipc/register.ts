import { ipcMain, dialog, shell, type BrowserWindow } from 'electron'
import { IPC, type IpcResult } from '@shared/ipc'
import { AppError, serializeError } from '@shared/errors'
import type {
  AppSettingsPatch,
  BrandProfileInput,
  CreateProject,
  UpdateProject,
  RedesignGenerateRequest,
  ExportRequest,
  ExperimentCreate,
  ExperimentResultInput
} from '@shared/schemas'
import type { MediaService } from '../services/MediaService'
import type { ProjectService } from '../services/ProjectService'
import type { BrandProfileService } from '../services/BrandProfileService'
import type { SettingsService } from '../services/SettingsService'
import type { SecureStorageService } from '../services/SecureStorageService'
import type { RedesignService } from '../services/RedesignService'
import type { DesignAnalysisService } from '../services/DesignAnalysisService'
import type { ExperimentService } from '../services/ExperimentService'
import type { ExportService } from '../services/ExportService'
import type { DiagnosticsService } from '../services/DiagnosticsService'
import type { UsageService } from '../services/UsageService'
import type { GeminiService } from '../gemini/GeminiService'
import { nowIso } from '../utils/ids'
import { logger } from '../utils/logger'

export interface IpcDeps {
  getWindow: () => BrowserWindow | null
  settings: SettingsService
  secureStorage: SecureStorageService
  gemini: GeminiService
  media: MediaService
  projects: ProjectService
  brandProfiles: BrandProfileService
  analysis: DesignAnalysisService
  redesign: RedesignService
  experiments: ExperimentService
  exports: ExportService
  diagnostics: DiagnosticsService
  usage: UsageService
  paths: { userDataPath: string; logsPath: string; dbPath: string }
  appVersion: string
}

/**
 * Enregistre UNIQUEMENT les canaux de la liste blanche (IPC).
 * Chaque handler est protégé : les exceptions sont sérialisées sans jamais exposer de secret.
 * La validation des entrées est effectuée par les services (schémas zod).
 */
export function registerIpc(deps: IpcDeps): void {
  const win = (): BrowserWindow | null => deps.getWindow()

  function safe<T>(fn: () => Promise<T> | T): Promise<IpcResult<T>> {
    return Promise.resolve()
      .then(() => fn())
      .then((data) => ({ ok: true as const, data }))
      .catch((error) => serializeError(error))
  }

  function handle(channel: string, fn: (...args: unknown[]) => unknown | Promise<unknown>): void {
    ipcMain.handle(channel, (_event, ...args: unknown[]) => safe(() => fn(...args)))
  }

  const str = (value: unknown, field: string): string => {
    if (typeof value !== 'string' || value.length === 0) {
      throw new AppError('ERR_VALIDATION', `Paramètre « ${field} » invalide.`)
    }
    return value
  }

  /* ---------------- App ---------------- */
  handle(IPC.app.info, () => ({
    app: 'Design Félicité AI',
    appVersion: deps.appVersion,
    electron: process.versions.electron ?? '',
    node: process.versions.node ?? '',
    chrome: process.versions.chrome ?? '',
    platform: process.platform,
    userDataPath: deps.paths.userDataPath,
    dbPath: deps.paths.dbPath,
    logsPath: deps.paths.logsPath
  }))

  handle(IPC.app.openLogs, async () => {
    await shell.openPath(deps.paths.logsPath)
  })

  handle(IPC.app.openDataDir, async () => {
    await shell.openPath(deps.paths.userDataPath)
  })

  /* ---------------- Settings ---------------- */
  handle(IPC.settings.get, () => deps.settings.get())
  handle(IPC.settings.update, (patch) => deps.settings.update(patch as AppSettingsPatch))

  /* ---------------- Secrets ---------------- */
  const secretStatus = () => ({
    configured: deps.secureStorage.hasKey(),
    encryptionAvailable: deps.secureStorage.isEncryptionAvailable(),
    storageMode: deps.secureStorage.storageMode(),
    lastTestAt: deps.settings.get().lastApiTestAt,
    lastTestOk: deps.settings.get().lastApiTestOk
  })

  handle(IPC.secrets.status, () => secretStatus())

  handle(IPC.secrets.setApiKey, async (apiKeyRaw) => {
    const apiKey = str(apiKeyRaw, 'apiKey')
    try {
      deps.secureStorage.setApiKey(apiKey)
    } catch (error) {
      if (error instanceof AppError && error.code === 'ERR_ENCRYPTION_UNAVAILABLE') {
        const window = win()
        const answer = window
          ? await dialog.showMessageBox(window, {
              type: 'warning',
              buttons: ['Annuler', 'Stocker en clair'],
              defaultId: 0,
              cancelId: 0,
              title: 'Chiffrement indisponible',
              message:
                'Le chiffrement système (DPAPI) est indisponible sur ce poste. Stocker la clé API en clair ?',
              detail:
                'La clé sera enregistrée non chiffrée dans le dossier de l’application. Cette option est déconseillée.'
            })
          : { response: 0 }
        if (answer.response !== 1) throw error
        deps.secureStorage.setApiKeyPlain(apiKey)
      } else {
        throw error
      }
    }
    deps.gemini.onApiKeyChanged()
    logger.info('Clé API mise à jour', { storageMode: deps.secureStorage.storageMode() })
    return secretStatus()
  })

  handle(IPC.secrets.testConnection, async () => {
    const result = await deps.gemini.testConnection()
    deps.settings.update({ lastApiTestAt: nowIso(), lastApiTestOk: result.ok })
    return result
  })

  handle(IPC.secrets.deleteApiKey, () => {
    deps.secureStorage.deleteApiKey()
    deps.gemini.onApiKeyChanged()
    logger.info('Clé API supprimée')
    return secretStatus()
  })

  /* ---------------- Profils de marque ---------------- */
  handle(IPC.profiles.list, () => deps.brandProfiles.list())
  handle(IPC.profiles.create, (input) => deps.brandProfiles.create(input as BrandProfileInput))
  handle(IPC.profiles.update, (id, input) =>
    deps.brandProfiles.update(str(id, 'id'), input as BrandProfileInput)
  )
  handle(IPC.profiles.delete, (id) => {
    deps.brandProfiles.delete(str(id, 'id'))
  })

  /* ---------------- Projets ---------------- */
  handle(IPC.projects.list, (opts) =>
    deps.projects.list((opts as { includeArchived?: boolean } | undefined) ?? undefined)
  )
  handle(IPC.projects.get, (id) => deps.projects.get(str(id, 'id')))
  handle(IPC.projects.create, (input) => deps.projects.create(input as CreateProject))
  handle(IPC.projects.update, (patch) => deps.projects.update(patch as UpdateProject))
  handle(IPC.projects.recent, (limit) => deps.projects.recent(typeof limit === 'number' ? limit : 6))
  handle(IPC.projects.delete, (id) => {
    const projectId = str(id, 'id')
    deps.projects.delete(projectId)
    deps.media.removeProjectMedia(projectId)
  })

  /* ---------------- Médias ---------------- */
  handle(IPC.media.list, (projectId) => deps.media.listByProject(str(projectId, 'projectId')))

  handle(IPC.media.importDialog, async (projectIdRaw) => {
    const projectId = str(projectIdRaw, 'projectId')
    const window = win()
    const result = window
      ? await dialog.showOpenDialog(window, {
          title: 'Importer des images de design',
          properties: ['openFile', 'multiSelections'],
          filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
        })
      : { canceled: true, filePaths: [] as string[] }
    if (result.canceled || result.filePaths.length === 0) return []
    return deps.media.importFromPaths(projectId, result.filePaths)
  })

  handle(IPC.media.importPaths, (projectId, paths) =>
    deps.media.importFromPaths(str(projectId, 'projectId'), Array.isArray(paths) ? (paths as string[]) : [])
  )
  handle(IPC.media.remove, (imageId) => {
    deps.media.remove(str(imageId, 'imageId'))
  })

  /* ---------------- Analyse ---------------- */
  handle(IPC.analysis.run, (request) =>
    deps.analysis.run(request as Parameters<DesignAnalysisService['run']>[0])
  )
  handle(IPC.analysis.cancel, (analysisId) => {
    deps.analysis.cancel(str(analysisId, 'analysisId'))
  })
  handle(IPC.analysis.detail, (analysisId) => deps.analysis.detail(str(analysisId, 'analysisId')))
  handle(IPC.analysis.byProject, (projectId) => deps.analysis.byProject(str(projectId, 'projectId')))
  handle(IPC.analysis.delete, (analysisId) => {
    deps.analysis.delete(str(analysisId, 'analysisId'))
  })
  handle(IPC.analysis.selectRecommendations, (analysisId, selectedIds) =>
    deps.analysis.selectRecommendations(
      str(analysisId, 'analysisId'),
      Array.isArray(selectedIds) ? (selectedIds as string[]) : []
    )
  )

  /* ---------------- Redesign ---------------- */
  handle(IPC.redesign.buildPrompt, (request) =>
    deps.redesign.buildPrompt(request as Omit<RedesignGenerateRequest, 'workingPrompt'>)
  )
  handle(IPC.redesign.generate, (request) => deps.redesign.generate(request as RedesignGenerateRequest))
  handle(IPC.redesign.cancel, (jobId) => {
    deps.redesign.cancel(str(jobId, 'jobId'))
  })
  handle(IPC.redesign.variantsByProject, (projectId) =>
    deps.redesign.variantsByProject(str(projectId, 'projectId'))
  )
  handle(IPC.redesign.variantsByAnalysis, (analysisId) =>
    deps.redesign.variantsByAnalysis(str(analysisId, 'analysisId'))
  )
  handle(IPC.redesign.deleteVariant, (variantId) => {
    deps.redesign.deleteVariant(str(variantId, 'variantId'))
  })

  /* ---------------- Expériences ---------------- */
  handle(IPC.experiments.list, (projectId) => deps.experiments.list(str(projectId, 'projectId')))
  handle(IPC.experiments.create, (input) => deps.experiments.create(input as ExperimentCreate))
  handle(IPC.experiments.update, (id, patch) =>
    deps.experiments.update(str(id, 'id'), (patch as Partial<ExperimentCreate>) ?? {})
  )
  handle(IPC.experiments.remove, (id) => {
    deps.experiments.remove(str(id, 'id'))
  })
  handle(IPC.experiments.addResult, (experimentId, result) =>
    deps.experiments.addResult(str(experimentId, 'experimentId'), result as ExperimentResultInput)
  )
  handle(IPC.experiments.results, (experimentId) =>
    deps.experiments.results(str(experimentId, 'experimentId'))
  )
  handle(IPC.experiments.summary, (experimentId) =>
    deps.experiments.summary(str(experimentId, 'experimentId'))
  )

  /* ---------------- Exports ---------------- */
  handle(IPC.exports.create, (request) => deps.exports.create(request as ExportRequest))
  handle(IPC.exports.list, (projectId) => deps.exports.list(str(projectId, 'projectId')))
  handle(IPC.exports.reveal, (filePath) => {
    shell.showItemInFolder(str(filePath, 'filePath'))
  })
  handle(IPC.exports.delete, (id) => {
    deps.exports.delete(str(id, 'id'))
  })

  /* ---------------- Bibliothèque ---------------- */
  handle(IPC.library.search, (query) => deps.projects.search(typeof query === 'string' ? query : ''))

  /* ---------------- Diagnostics ---------------- */
  handle(IPC.diagnostics.get, () => deps.diagnostics.get())
  handle(IPC.diagnostics.backup, () => deps.diagnostics.backup())
  handle(IPC.diagnostics.restore, () => {
    deps.diagnostics.restore()
  })

  /* ---------------- Usage ---------------- */
  handle(IPC.usage.summary, () => deps.usage.summary())

  logger.info('Canaux IPC enregistrés')
}