/**
 * Contrat IPC : liste blanche des canaux autorisés et surface d'API exposée
 * au renderer via le preload. Aucun canal hors de cette liste n'est enregistré.
 */

import type {
  AppSettings,
  AppSettingsPatch,
  AnalysisContext,
  BrandProfile,
  BrandProfileInput,
  CreateProject,
  DesignReport,
  ExperimentCreate,
  ExperimentMetric,
  ExperimentResultInput,
  ExportRequest,
  RedesignGenerateRequest,
  RedesignMode,
  UpdateProject
} from './schemas'
import type { AppErrorCode } from './errors'

export const IPC = {
  app: {
    info: 'app:info',
    openLogs: 'app:open-logs',
    openDataDir: 'app:open-data-dir'
  },
  settings: {
    get: 'settings:get',
    update: 'settings:update'
  },
  secrets: {
    status: 'secrets:status',
    setApiKey: 'secrets:set-api-key',
    testConnection: 'secrets:test-connection',
    deleteApiKey: 'secrets:delete-api-key'
  },
  profiles: {
    list: 'profiles:list',
    create: 'profiles:create',
    update: 'profiles:update',
    delete: 'profiles:delete'
  },
  projects: {
    list: 'projects:list',
    get: 'projects:get',
    create: 'projects:create',
    update: 'projects:update',
    delete: 'projects:delete',
    recent: 'projects:recent'
  },
  media: {
    list: 'media:list',
    importDialog: 'media:import-dialog',
    importPaths: 'media:import-paths',
    remove: 'media:remove'
  },
  analysis: {
    run: 'analysis:run',
    cancel: 'analysis:cancel',
    detail: 'analysis:detail',
    byProject: 'analysis:by-project',
    delete: 'analysis:delete',
    selectRecommendations: 'analysis:select-recommendations'
  },
  redesign: {
    buildPrompt: 'redesign:build-prompt',
    generate: 'redesign:generate',
    cancel: 'redesign:cancel',
    variantsByProject: 'redesign:variants-by-project',
    variantsByAnalysis: 'redesign:variants-by-analysis',
    deleteVariant: 'redesign:delete-variant'
  },
  experiments: {
    list: 'experiments:list',
    create: 'experiments:create',
    update: 'experiments:update',
    remove: 'experiments:delete',
    addResult: 'experiments:add-result',
    results: 'experiments:results',
    summary: 'experiments:summary'
  },
  exports: {
    create: 'exports:create',
    list: 'exports:list',
    reveal: 'exports:reveal',
    delete: 'exports:delete'
  },
  library: {
    search: 'library:search'
  },
  diagnostics: {
    get: 'diagnostics:get',
    backup: 'diagnostics:backup',
    restore: 'diagnostics:restore'
  },
  usage: {
    summary: 'usage:summary'
  }
} as const

export const IPC_EVENTS = {
  analysisProgress: 'event:analysis-progress',
  redesignProgress: 'event:redesign-progress'
} as const

/* ------------------------------------------------------------------ */
/* DTO renvoyés au renderer                                            */
/* ------------------------------------------------------------------ */

export type ImageRole = 'original' | 'reference' | 'generated'
export type AnalysisStatus = 'running' | 'completed' | 'failed'

export interface ProjectDTO {
  id: string
  name: string
  brandProfileId: string | null
  favorite: boolean
  archived: boolean
  createdAt: string
  updatedAt: string
  imageCount: number
  analysisCount: number
  variantCount: number
}

export interface ImageDTO {
  id: string
  projectId: string
  fileName: string
  filePath: string
  mimeType: string
  width: number
  height: number
  sizeBytes: number
  sha256: string
  role: ImageRole
  createdAt: string
}

export interface AnalysisSummaryDTO {
  id: string
  projectId: string
  imageId: string
  status: AnalysisStatus
  model: string
  protocolVersion: string
  createdAt: string
  felicityIndex: number | null
  productSummary: string | null
  errorCode: AppErrorCode | null
}

export interface AnalysisDetailDTO extends AnalysisSummaryDTO {
  report: DesignReport | null
  image: ImageDTO | null
  selectedRecommendationIds: string[]
}

export interface VariantDTO {
  id: string
  projectId: string
  analysisId: string | null
  parentVariantId: string | null
  sourceImageId: string
  imageId: string | null
  mode: RedesignMode
  promptText: string
  model: string
  status: 'completed' | 'failed'
  selectedRecommendationIds: string[]
  extraInstruction: string
  params: Record<string, unknown> | null
  createdAt: string
  image: ImageDTO | null
  errorCode: AppErrorCode | null
}

export interface ExperimentDTO {
  id: string
  projectId: string
  name: string
  hypothesis: string
  variantAId: string | null
  variantBId: string | null
  audience: string
  channel: string
  primaryMetric: ExperimentMetric
  notes: string
  createdAt: string
  updatedAt: string
}

export interface ExperimentResultDTO {
  id: string
  experimentId: string
  variant: 'original' | 'A' | 'B'
  metric: ExperimentMetric
  value: number
  sampleSize: number | null
  source: string
  note: string
  recordedAt: string
}

export interface ExperimentSummaryDTO {
  experimentId: string
  metric: ExperimentMetric
  verdict: 'insufficient_data' | 'variant_a' | 'variant_b' | 'original' | 'no_difference'
  message: string
  perVariant: Array<{ variant: 'original' | 'A' | 'B'; average: number | null; samples: number }>
}

export interface ExportDTO {
  id: string
  projectId: string
  analysisId: string
  format: 'pdf' | 'json'
  filePath: string
  createdAt: string
}

export interface SecretStatusDTO {
  configured: boolean
  encryptionAvailable: boolean
  storageMode: 'encrypted' | 'unavailable' | 'none'
  lastTestAt: string | null
  lastTestOk: boolean | null
}

export interface ConnectionTestResultDTO {
  ok: boolean
  model: string
  latencyMs: number
  message: string
  errorCode?: AppErrorCode
}

export interface AppInfoDTO {
  app: string
  appVersion: string
  electron: string
  node: string
  chrome: string
  platform: string
  userDataPath: string
  dbPath: string
  logsPath: string
}

export interface DiagnosticsDTO {
  dbPath: string
  dbSizeBytes: number
  dbIntegrity: 'ok' | 'error' | 'unknown'
  userDataPath: string
  logsPath: string
  mediaPath: string
  backupsPath: string
  projectCount: number
  imageCount: number
  analysisCount: number
  variantCount: number
  encryptionAvailable: boolean
  apiConfigured: boolean
  backupFiles: Array<{ name: string; sizeBytes: number; createdAt: string }>
}

export interface UsageSummaryDTO {
  analysisCount: number
  estimatedCostUsd: number
  lastUsage: {
    promptTokens: number | null
    outputTokens: number | null
    totalTokens: number | null
    estimatedCostUsd: number | null
  } | null
}

export interface RedesignPromptDTO {
  prompt: string
  mode: RedesignMode
  origin: 'auto' | 'manual'
  selectedRecommendationIds: string[]
  warnings: string[]
}

export interface AnalysisProgressEvent {
  analysisId: string
  stage: string
  progress: number
  message: string
}

export interface RedesignProgressEvent {
  jobId: string
  stage: string
  progress: number
  message: string
}

/* ------------------------------------------------------------------ */
/* Résultat IPC uniforme                                               */
/* ------------------------------------------------------------------ */

export type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: AppErrorCode; userMessage: string; details?: Record<string, unknown>; retryable: boolean } }

/* ------------------------------------------------------------------ */
/* Surface d'API exposée par le preload (window.api)                   */
/* ------------------------------------------------------------------ */

export interface DesignApi {
  app: {
    info(): Promise<IpcResult<AppInfoDTO>>
    openLogs(): Promise<IpcResult<void>>
    openDataDir(): Promise<IpcResult<void>>
  }
  settings: {
    get(): Promise<IpcResult<AppSettings>>
    update(patch: AppSettingsPatch): Promise<IpcResult<AppSettings>>
  }
  secrets: {
    status(): Promise<IpcResult<SecretStatusDTO>>
    setApiKey(apiKey: string): Promise<IpcResult<SecretStatusDTO>>
    testConnection(): Promise<IpcResult<ConnectionTestResultDTO>>
    deleteApiKey(): Promise<IpcResult<SecretStatusDTO>>
  }
  profiles: {
    list(): Promise<IpcResult<BrandProfile[]>>
    create(input: BrandProfileInput): Promise<IpcResult<BrandProfile>>
    update(id: string, input: BrandProfileInput): Promise<IpcResult<BrandProfile>>
    delete(id: string): Promise<IpcResult<void>>
  }
  projects: {
    list(opts?: { includeArchived?: boolean }): Promise<IpcResult<ProjectDTO[]>>
    get(id: string): Promise<IpcResult<ProjectDTO>>
    create(input: CreateProject): Promise<IpcResult<ProjectDTO>>
    update(patch: UpdateProject): Promise<IpcResult<ProjectDTO>>
    delete(id: string): Promise<IpcResult<void>>
    recent(limit?: number): Promise<IpcResult<ProjectDTO[]>>
  }
  media: {
    list(projectId: string): Promise<IpcResult<ImageDTO[]>>
    importDialog(projectId: string): Promise<IpcResult<ImageDTO[]>>
    importPaths(projectId: string, paths: string[]): Promise<IpcResult<ImageDTO[]>>
    remove(imageId: string): Promise<IpcResult<void>>
  }
  analysis: {
    run(request: {
      projectId: string
      imageId: string
      context: AnalysisContext
      brandProfileId?: string | null
    }): Promise<IpcResult<AnalysisDetailDTO>>
    cancel(analysisId: string): Promise<IpcResult<void>>
    detail(analysisId: string): Promise<IpcResult<AnalysisDetailDTO>>
    byProject(projectId: string): Promise<IpcResult<AnalysisSummaryDTO[]>>
    delete(analysisId: string): Promise<IpcResult<void>>
    selectRecommendations(analysisId: string, selectedIds: string[]): Promise<IpcResult<void>>
  }
  redesign: {
    buildPrompt(request: Omit<RedesignGenerateRequest, 'workingPrompt'>): Promise<IpcResult<RedesignPromptDTO>>
    generate(request: RedesignGenerateRequest): Promise<IpcResult<VariantDTO>>
    cancel(jobId: string): Promise<IpcResult<void>>
    variantsByProject(projectId: string): Promise<IpcResult<VariantDTO[]>>
    variantsByAnalysis(analysisId: string): Promise<IpcResult<VariantDTO[]>>
    deleteVariant(variantId: string): Promise<IpcResult<void>>
  }
  experiments: {
    list(projectId: string): Promise<IpcResult<ExperimentDTO[]>>
    create(input: ExperimentCreate): Promise<IpcResult<ExperimentDTO>>
    update(id: string, patch: Partial<ExperimentCreate>): Promise<IpcResult<ExperimentDTO>>
    remove(id: string): Promise<IpcResult<void>>
    addResult(experimentId: string, result: ExperimentResultInput): Promise<IpcResult<ExperimentResultDTO>>
    results(experimentId: string): Promise<IpcResult<ExperimentResultDTO[]>>
    summary(experimentId: string): Promise<IpcResult<ExperimentSummaryDTO>>
  }
  exports: {
    create(request: ExportRequest): Promise<IpcResult<ExportDTO>>
    list(projectId: string): Promise<IpcResult<ExportDTO[]>>
    reveal(filePath: string): Promise<IpcResult<void>>
    delete(id: string): Promise<IpcResult<void>>
  }
  library: {
    search(query: string): Promise<IpcResult<ProjectDTO[]>>
  }
  diagnostics: {
    get(): Promise<IpcResult<DiagnosticsDTO>>
    backup(): Promise<IpcResult<{ filePath: string }>>
    restore(): Promise<IpcResult<void>>
  }
  usage: {
    summary(): Promise<IpcResult<UsageSummaryDTO>>
  }
  events: {
    onAnalysisProgress(cb: (event: AnalysisProgressEvent) => void): () => void
    onRedesignProgress(cb: (event: RedesignProgressEvent) => void): () => void
  }
}
