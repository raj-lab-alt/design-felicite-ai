import { useCallback, useEffect, useState } from 'react'
import { DatabaseBackup, FolderOpen, HardDriveDownload, RefreshCcw, ShieldAlert } from 'lucide-react'
import { Badge, Button, Card, CardHeader, Spinner } from '../components/ui'
import { call } from '../lib/api'
import { formatBytes, formatDateTime } from '../lib/format'
import { useAppStore } from '../store/useAppStore'
import type { DiagnosticsDTO } from '@shared/ipc'

export function DiagnosticsPage(): React.JSX.Element {
  const toast = useAppStore((s) => s.toast)
  const [data, setData] = useState<DiagnosticsDTO | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setData(await call(window.api.diagnostics.get()))
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Chargement impossible.')
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const backup = async (): Promise<void> => {
    setBusy('backup')
    try {
      const result = await call(window.api.diagnostics.backup())
      toast('success', `Sauvegarde créée : ${result.filePath}`)
      void load()
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Sauvegarde impossible.')
    } finally {
      setBusy(null)
    }
  }

  const restore = async (): Promise<void> => {
    if (
      !confirm(
        'Restaurer une sauvegarde remplacera la base actuelle. L’application redémarrera. Continuer ?'
      )
    )
      return
    setBusy('restore')
    try {
      await call(window.api.diagnostics.restore())
      toast('success', 'Base restaurée. Redémarrage en cours…')
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Restauration impossible.')
    } finally {
      setBusy(null)
    }
  }

  if (!data) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Diagnostics & sauvegardes</h1>
          <p className="text-sm text-ink-dim">État de la base locale, dossiers et sauvegardes.</p>
        </div>
        <Button variant="outline" size="sm" icon={<RefreshCcw className="h-4 w-4" />} onClick={() => void load()}>
          Actualiser
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="py-4">
          <p className="text-[11px] uppercase tracking-wider text-ink-faint">Intégrité base</p>
          <p className="mt-1">
            <Badge tone={data.dbIntegrity === 'ok' ? 'ok' : data.dbIntegrity === 'error' ? 'danger' : 'warn'}>
              {data.dbIntegrity === 'ok' ? 'Saine' : data.dbIntegrity === 'error' ? 'Corrompue' : 'Inconnue'}
            </Badge>
          </p>
          <p className="mt-1 text-xs text-ink-dim">{formatBytes(data.dbSizeBytes)}</p>
        </Card>
        <Card className="py-4">
          <p className="text-[11px] uppercase tracking-wider text-ink-faint">Chiffrement clé API</p>
          <p className="mt-1">
            <Badge tone={data.encryptionAvailable ? 'ok' : 'warn'}>
              {data.encryptionAvailable ? 'Disponible' : 'Indisponible'}
            </Badge>
          </p>
          <p className="mt-1 text-xs text-ink-dim">{data.apiConfigured ? 'Clé configurée' : 'Aucune clé'}</p>
        </Card>
        <Card className="py-4">
          <p className="text-[11px] uppercase tracking-wider text-ink-faint">Contenus</p>
          <p className="mt-1 text-xs text-ink-dim">
            {data.projectCount} projets · {data.imageCount} images · {data.analysisCount} analyses · {data.variantCount} variantes
          </p>
        </Card>
      </div>

      <Card>
        <CardHeader title="Dossiers" subtitle="Vos données restent locales, dans votre profil Windows." />
        <div className="space-y-2 text-xs">
          {[
            { label: 'Dossier de données', value: data.userDataPath },
            { label: 'Base de données', value: data.dbPath },
            { label: 'Images', value: data.mediaPath },
            { label: 'Journaux', value: data.logsPath },
            { label: 'Sauvegardes', value: data.backupsPath }
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3 rounded-lg bg-panel-2 p-3">
              <span className="text-ink-dim">{row.label}</span>
              <code className="truncate text-[11px] text-ink-faint">{row.value}</code>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" icon={<FolderOpen className="h-4 w-4" />} onClick={() => void call(window.api.app.openDataDir())}>
            Ouvrir le dossier de données
          </Button>
          <Button size="sm" variant="outline" icon={<HardDriveDownload className="h-4 w-4" />} onClick={() => void call(window.api.app.openLogs())}>
            Ouvrir les journaux
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Sauvegardes"
          subtitle="La sauvegarde inclut la base de données (pas les images)."
          actions={
            <div className="flex gap-2">
              <Button size="sm" loading={busy === 'backup'} icon={<DatabaseBackup className="h-4 w-4" />} onClick={() => void backup()}>
                Sauvegarder
              </Button>
              <Button
                size="sm"
                variant="danger"
                loading={busy === 'restore'}
                icon={<ShieldAlert className="h-4 w-4" />}
                onClick={() => void restore()}
              >
                Restaurer
              </Button>
            </div>
          }
        />
        {data.backupFiles.length === 0 ? (
          <p className="text-xs text-ink-faint">Aucune sauvegarde pour le moment.</p>
        ) : (
          <ul className="space-y-2">
            {data.backupFiles.map((file) => (
              <li key={file.name} className="flex items-center justify-between gap-3 rounded-lg bg-panel-2 p-3 text-xs">
                <span className="truncate text-ink-dim">{file.name}</span>
                <span className="shrink-0 text-ink-faint">
                  {formatBytes(file.sizeBytes)} · {formatDateTime(file.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[11px] text-warn">
          La restauration remplace la base actuelle : utilisez-la en dernier recours, après avoir créé une sauvegarde.
        </p>
      </Card>
    </div>
  )
}