import {
  app,
  BrowserWindow,
  Menu,
  protocol,
  session,
  shell,
  type BrowserWindow as WindowType
} from 'electron'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { APP_NAME } from '@shared/constants'
import { IPC_EVENTS } from '@shared/ipc'
import { configureLogger, logger } from './utils/logger'
import { DatabaseService } from './db/DatabaseService'
import { SettingsService } from './services/SettingsService'
import { SecureStorageService } from './services/SecureStorageService'
import { MediaService } from './services/MediaService'
import { ProjectService } from './services/ProjectService'
import { BrandProfileService } from './services/BrandProfileService'
import { DesignAnalysisService } from './services/DesignAnalysisService'
import { RedesignService } from './services/RedesignService'
import { ExperimentService } from './services/ExperimentService'
import { ExportService } from './services/ExportService'
import { DiagnosticsService, type AppPaths } from './services/DiagnosticsService'
import { UsageService } from './services/UsageService'
import { UpdaterService } from './services/UpdaterService'
import { NativeImageOptimizer } from './utils/imageOptimizer'
import { loadProtocol } from './protocol/loadProtocol'
import { GeminiService } from './gemini/GeminiService'
import { registerIpc } from './ipc/register'
import type { ProgressHub } from './services/ProgressHub'

/* ------------------------------------------------------------------ */
/* Chemins locaux (aucune donnée ne sort de la machine hors API Gemini) */
/* ------------------------------------------------------------------ */
if (process.env.DESIGN_FELICITE_HOME) {
  app.setPath('userData', process.env.DESIGN_FELICITE_HOME)
} else {
  app.setPath('userData', join(app.getPath('appData'), 'design-felicite-ai'))
}

/**
 * Le schéma `media:` sert les images locales au renderer (thumbnails, aperçus)
 * sans exposer le système de fichiers. Il doit être déclaré privilégié avant
 * le démarrage de l'application.
 */
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: false }
  }
])

const userDataPath = app.getPath('userData')
const dataPath = join(userDataPath, 'data')
const dbPath = join(dataPath, 'design-felicite.db')
const logsPath = join(userDataPath, 'logs')
const mediaPath = join(userDataPath, 'media')
const backupsPath = join(userDataPath, 'backups')
const exportsPath = join(userDataPath, 'exports')
const credentialsPath = join(dataPath, 'credentials.json')

for (const dir of [dataPath, logsPath, mediaPath, backupsPath, exportsPath]) {
  mkdirSync(dir, { recursive: true })
}
configureLogger(join(logsPath, 'design-felicite.log'))

let mainWindow: WindowType | null = null

/* ------------------------------------------------------------------ */
/* Bootstrap des services                                              */
/* ------------------------------------------------------------------ */
const db = new DatabaseService(dbPath)
db.open()

const settings = new SettingsService(db)
const secureStorage = new SecureStorageService(credentialsPath)
const gemini = new GeminiService(secureStorage, settings)
const media = new MediaService(db, mediaPath)
const projects = new ProjectService(db)
const brandProfiles = new BrandProfileService(db)
const paths: AppPaths = { userDataPath, dbPath, logsPath, mediaPath, backupsPath }

const hub: ProgressHub = {
  analysis(event) {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send(IPC_EVENTS.analysisProgress, event)
    }
  },
  redesign(event) {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send(IPC_EVENTS.redesignProgress, event)
    }
  }
}

const analysis = new DesignAnalysisService({
  db,
  media,
  brandProfiles,
  settings,
  gemini,
  protocol: () => loadProtocol(),
  optimizer: new NativeImageOptimizer(),
  hub
})

const redesign = new RedesignService({
  db,
  media,
  settings,
  gemini,
  analysis,
  brandProfiles,
  optimizer: new NativeImageOptimizer(),
  hub
})

const experiments = new ExperimentService(db)
const exportsService = new ExportService(db, media, analysis, exportsPath)
const diagnostics = new DiagnosticsService(db, secureStorage, gemini, paths)
const usage = new UsageService(db)
const updater = new UpdaterService()
updater.onChange((status) => {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(IPC_EVENTS.updateStatus, status)
  }
})

/* ------------------------------------------------------------------ */
/* IPC (liste blanche)                                                 */
/* ------------------------------------------------------------------ */
registerIpc({
  getWindow: () => mainWindow,
  settings,
  secureStorage,
  gemini,
  media,
  projects,
  brandProfiles,
  analysis,
  redesign,
  experiments,
  exports: exportsService,
  diagnostics,
  usage,
  updater,
  paths: { userDataPath, logsPath, dbPath },
  appVersion: app.getVersion()
})

/* ------------------------------------------------------------------ */
/* Durcissement de la sécurité du renderer (après `ready`)            */
/* ------------------------------------------------------------------ */
/** Autorise uniquement le presse-papiers (copier/coller) ; refuse tout le reste (médias, géolocalisation, notifications…). */
const PERMISSION_ALLOWLIST = new Set(['clipboard-read', 'clipboard-write', 'fullscreen'])

function hardenSession(): void {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(PERMISSION_ALLOWLIST.has(permission))
  })
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) =>
    PERMISSION_ALLOWLIST.has(permission)
  )
}

app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  contents.on('will-navigate', (event) => event.preventDefault())
})

/* ------------------------------------------------------------------ */
/* Fenêtre principale                                                  */
/* ------------------------------------------------------------------ */
const isDev = Boolean(process.env.ELECTRON_RENDERER_URL)

/** Sert les images locales au renderer via `media://image/<id>` (lecture seule, id validé). */
function registerMediaProtocol(): void {
  session.defaultSession.protocol.handle('media', (request) => {
    try {
      const url = new URL(request.url)
      const imageId = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
      if (url.host !== 'image' || !imageId) {
        return new Response('Introuvable', { status: 404 })
      }
      const image = media.getById(imageId)
      if (!image) return new Response('Introuvable', { status: 404 })
      const buffer = media.readFile(imageId)
      return new Response(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': image.mimeType,
          'Cache-Control': 'no-cache'
        }
      })
    } catch (error) {
      logger.warn('Lecture d’un média impossible', { error: String(error) })
      return new Response('Erreur de lecture', { status: 500 })
    }
  })
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    title: APP_NAME,
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      webviewTag: false
    }
  })

  mainWindow = window
  window.once('ready-to-show', () => window.show())
  window.webContents.on('did-finish-load', () => {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_EVENTS.updateStatus, updater.status())
    }
  })

  if (isDev) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL as string)
    window.webContents.openDevTools({ mode: 'detach' })
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null
  })
}

/* ------------------------------------------------------------------ */
/* Cycle de vie                                                        */
/* ------------------------------------------------------------------ */
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  Menu.setApplicationMenu(null)

  app.whenReady().then(() => {
    hardenSession()
    registerMediaProtocol()
    logger.info('Démarrage de l’application', {
      version: app.getVersion(),
      electron: process.versions.electron,
      node: process.versions.node,
      platform: process.platform,
      schemaVersion: db.getSchemaVersion()
    })
    createWindow()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', () => {
    logger.info('Arrêt de l’application')
    db.close()
  })
}