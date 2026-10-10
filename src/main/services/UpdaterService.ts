import { app } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { autoUpdater, type UpdateInfo } from 'electron-updater'
import type { UpdateStatus } from '@shared/ipc'
import { AppError } from '@shared/errors'
import { logger } from '../utils/logger'

type Listener = (status: UpdateStatus) => void

/**
 * Canal de mise à jour automatique.
 *
 * Désactivé tant que :
 *  - l'application n'est pas empaquetée (développement), ou
 *  - aucun dépôt n'est configuré (variable `DESIGN_FELICITE_UPDATE_URL`
 *    pour les tests, ou `Resources/app-update.yml` généré par electron-builder
 *    à la compilation pour la production).
 */
export class UpdaterService {
  private state: UpdateStatus = { state: 'disabled', message: 'Mises à jour désactivées.' }
  private listeners = new Set<Listener>()
  private enabled = false

  constructor() {
    this.enabled = this.resolveEnabled()
    if (!this.enabled) {
      logger.info('Canal de mise à jour désactivé (aucun dépôt configuré)')
      return
    }

    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.logger = {
      info: (message?: unknown) => logger.info(message == null ? '' : String(message)),
      warn: (message?: unknown) => logger.warn(message == null ? '' : String(message)),
      error: (message?: unknown) => logger.error(message == null ? '' : String(message))
    }
    this.setState({ state: 'idle', currentVersion: app.getVersion() })

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      logger.info('Mise à jour disponible', { version: info.version })
      this.setState({
        state: 'available',
        version: info.version,
        notes: info.releaseNotes == null ? null : String(info.releaseNotes)
      })
    })
    autoUpdater.on('update-not-available', () => {
      this.setState({ state: 'up-to-date', message: 'L’application est à jour.' })
    })
    autoUpdater.on('download-progress', (progress) => {
      this.setState({ state: 'downloading', percent: Math.round(progress.percent) })
    })
    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      this.setState({ state: 'downloaded', version: info.version })
    })
    autoUpdater.on('error', (error) => {
      logger.warn('Échec du canal de mise à jour', { message: error?.message })
      this.setState({
        state: 'error',
        message: `Impossible de vérifier les mises à jour : ${error?.message ?? 'erreur inconnue'}`
      })
    })
  }

  status(): UpdateStatus {
    return this.state
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener)
    listener(this.state)
    return () => this.listeners.delete(listener)
  }

  async check(): Promise<UpdateStatus> {
    if (!this.enabled) return this.state
    this.setState({ state: 'checking', message: 'Vérification des mises à jour…' })
    try {
      await autoUpdater.checkForUpdates()
    } catch (error) {
      this.setState({
        state: 'error',
        message: error instanceof Error ? error.message : 'Erreur lors de la vérification.'
      })
    }
    return this.state
  }

  install(): void {
    if (!this.enabled || this.state.state !== 'downloaded') {
      throw new AppError('ERR_NOT_READY', 'Aucune mise à jour prête à être installée.')
    }
    // Quitte l'application immédiatement puis installe silencieusement.
    autoUpdater.quitAndInstall(true, true)
  }

  private resolveEnabled(): boolean {
    if (!app.isPackaged) return false
    const envUrl = process.env.DESIGN_FELICITE_UPDATE_URL
    if (envUrl) {
      autoUpdater.setFeedURL({ provider: 'generic', url: envUrl, useMultipleRangeRequest: true })
      return true
    }
    // electron-builder génère `app-update.yml` quand une section `publish` existe.
    return existsSync(join(process.resourcesPath, 'app-update.yml'))
  }

  private setState(next: UpdateStatus): void {
    this.state = next
    for (const listener of this.listeners) listener(next)
  }
}