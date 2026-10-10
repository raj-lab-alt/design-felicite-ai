import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  IPC,
  IPC_EVENTS,
  type AnalysisProgressEvent,
  type DesignApi,
  type RedesignProgressEvent,
  type UpdateStatus
} from '@shared/ipc'

/**
 * Passerelle : expose UNIQUEMENT la surface déclarée par DesignApi.
 * contextIsolation est actif, sandbox est actif, nodeIntegration est inactif.
 * Aucun canal hors liste blanche n'est accessible depuis le renderer.
 */
const invoke = (channel: string, ...args: unknown[]): Promise<unknown> =>
  ipcRenderer.invoke(channel, ...args)

const subscribe = <T>(channel: string, cb: (payload: T) => void): (() => void) => {
  const listener = (_event: IpcRendererEvent, payload: T): void => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: DesignApi = {
  app: {
    info: () => invoke(IPC.app.info) as ReturnType<DesignApi['app']['info']>,
    openLogs: () => invoke(IPC.app.openLogs) as ReturnType<DesignApi['app']['openLogs']>,
    openDataDir: () => invoke(IPC.app.openDataDir) as ReturnType<DesignApi['app']['openDataDir']>,
    checkUpdate: () => invoke(IPC.app.checkUpdate) as ReturnType<DesignApi['app']['checkUpdate']>,
    installUpdate: () => invoke(IPC.app.installUpdate) as ReturnType<DesignApi['app']['installUpdate']>,
    updateStatus: () => invoke(IPC.app.updateStatus) as ReturnType<DesignApi['app']['updateStatus']>
  },
  settings: {
    get: () => invoke(IPC.settings.get) as ReturnType<DesignApi['settings']['get']>,
    update: (patch) => invoke(IPC.settings.update, patch) as ReturnType<DesignApi['settings']['update']>
  },
  secrets: {
    status: () => invoke(IPC.secrets.status) as ReturnType<DesignApi['secrets']['status']>,
    setApiKey: (apiKey) =>
      invoke(IPC.secrets.setApiKey, apiKey) as ReturnType<DesignApi['secrets']['setApiKey']>,
    testConnection: () =>
      invoke(IPC.secrets.testConnection) as ReturnType<DesignApi['secrets']['testConnection']>,
    deleteApiKey: () =>
      invoke(IPC.secrets.deleteApiKey) as ReturnType<DesignApi['secrets']['deleteApiKey']>
  },
  profiles: {
    list: () => invoke(IPC.profiles.list) as ReturnType<DesignApi['profiles']['list']>,
    create: (input) =>
      invoke(IPC.profiles.create, input) as ReturnType<DesignApi['profiles']['create']>,
    update: (id, input) =>
      invoke(IPC.profiles.update, id, input) as ReturnType<DesignApi['profiles']['update']>,
    delete: (id) => invoke(IPC.profiles.delete, id) as ReturnType<DesignApi['profiles']['delete']>
  },
  projects: {
    list: (opts) => invoke(IPC.projects.list, opts) as ReturnType<DesignApi['projects']['list']>,
    get: (id) => invoke(IPC.projects.get, id) as ReturnType<DesignApi['projects']['get']>,
    create: (input) => invoke(IPC.projects.create, input) as ReturnType<DesignApi['projects']['create']>,
    update: (patch) => invoke(IPC.projects.update, patch) as ReturnType<DesignApi['projects']['update']>,
    delete: (id) => invoke(IPC.projects.delete, id) as ReturnType<DesignApi['projects']['delete']>,
    recent: (limit) => invoke(IPC.projects.recent, limit) as ReturnType<DesignApi['projects']['recent']>
  },
  media: {
    list: (projectId) => invoke(IPC.media.list, projectId) as ReturnType<DesignApi['media']['list']>,
    importDialog: (projectId) =>
      invoke(IPC.media.importDialog, projectId) as ReturnType<DesignApi['media']['importDialog']>,
    importPaths: (projectId, paths) =>
      invoke(IPC.media.importPaths, projectId, paths) as ReturnType<DesignApi['media']['importPaths']>,
    remove: (imageId) => invoke(IPC.media.remove, imageId) as ReturnType<DesignApi['media']['remove']>
  },
  analysis: {
    run: (request) => invoke(IPC.analysis.run, request) as ReturnType<DesignApi['analysis']['run']>,
    cancel: (analysisId) =>
      invoke(IPC.analysis.cancel, analysisId) as ReturnType<DesignApi['analysis']['cancel']>,
    detail: (analysisId) =>
      invoke(IPC.analysis.detail, analysisId) as ReturnType<DesignApi['analysis']['detail']>,
    byProject: (projectId) =>
      invoke(IPC.analysis.byProject, projectId) as ReturnType<DesignApi['analysis']['byProject']>,
    delete: (analysisId) =>
      invoke(IPC.analysis.delete, analysisId) as ReturnType<DesignApi['analysis']['delete']>,
    selectRecommendations: (analysisId, selectedIds) =>
      invoke(IPC.analysis.selectRecommendations, analysisId, selectedIds) as ReturnType<
        DesignApi['analysis']['selectRecommendations']
      >
  },
  redesign: {
    buildPrompt: (request) =>
      invoke(IPC.redesign.buildPrompt, request) as ReturnType<DesignApi['redesign']['buildPrompt']>,
    generate: (request) =>
      invoke(IPC.redesign.generate, request) as ReturnType<DesignApi['redesign']['generate']>,
    cancel: (jobId) => invoke(IPC.redesign.cancel, jobId) as ReturnType<DesignApi['redesign']['cancel']>,
    variantsByProject: (projectId) =>
      invoke(IPC.redesign.variantsByProject, projectId) as ReturnType<
        DesignApi['redesign']['variantsByProject']
      >,
    variantsByAnalysis: (analysisId) =>
      invoke(IPC.redesign.variantsByAnalysis, analysisId) as ReturnType<
        DesignApi['redesign']['variantsByAnalysis']
      >,
    deleteVariant: (variantId) =>
      invoke(IPC.redesign.deleteVariant, variantId) as ReturnType<DesignApi['redesign']['deleteVariant']>
  },
  experiments: {
    list: (projectId) => invoke(IPC.experiments.list, projectId) as ReturnType<DesignApi['experiments']['list']>,
    create: (input) => invoke(IPC.experiments.create, input) as ReturnType<DesignApi['experiments']['create']>,
    update: (id, patch) =>
      invoke(IPC.experiments.update, id, patch) as ReturnType<DesignApi['experiments']['update']>,
    remove: (id) => invoke(IPC.experiments.remove, id) as ReturnType<DesignApi['experiments']['remove']>,
    addResult: (experimentId, result) =>
      invoke(IPC.experiments.addResult, experimentId, result) as ReturnType<
        DesignApi['experiments']['addResult']
      >,
    results: (experimentId) =>
      invoke(IPC.experiments.results, experimentId) as ReturnType<DesignApi['experiments']['results']>,
    summary: (experimentId) =>
      invoke(IPC.experiments.summary, experimentId) as ReturnType<DesignApi['experiments']['summary']>
  },
  exports: {
    create: (request) => invoke(IPC.exports.create, request) as ReturnType<DesignApi['exports']['create']>,
    list: (projectId) => invoke(IPC.exports.list, projectId) as ReturnType<DesignApi['exports']['list']>,
    reveal: (filePath) => invoke(IPC.exports.reveal, filePath) as ReturnType<DesignApi['exports']['reveal']>,
    delete: (id) => invoke(IPC.exports.delete, id) as ReturnType<DesignApi['exports']['delete']>
  },
  library: {
    search: (query) => invoke(IPC.library.search, query) as ReturnType<DesignApi['library']['search']>
  },
  diagnostics: {
    get: () => invoke(IPC.diagnostics.get) as ReturnType<DesignApi['diagnostics']['get']>,
    backup: () => invoke(IPC.diagnostics.backup) as ReturnType<DesignApi['diagnostics']['backup']>,
    restore: () => invoke(IPC.diagnostics.restore) as ReturnType<DesignApi['diagnostics']['restore']>
  },
  usage: {
    summary: () => invoke(IPC.usage.summary) as ReturnType<DesignApi['usage']['summary']>
  },
  events: {
    onAnalysisProgress: (cb: (event: AnalysisProgressEvent) => void) =>
      subscribe(IPC_EVENTS.analysisProgress, cb),
    onRedesignProgress: (cb: (event: RedesignProgressEvent) => void) =>
      subscribe(IPC_EVENTS.redesignProgress, cb),
    onUpdateStatus: (cb: (status: UpdateStatus) => void) => subscribe(IPC_EVENTS.updateStatus, cb)
  }
}

contextBridge.exposeInMainWorld('api', api)