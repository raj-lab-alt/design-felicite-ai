import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, FlaskConical, ImageDown } from 'lucide-react'
import { Badge, Button, Card, EmptyState, Spinner, Tabs, TabsContent } from '../components/ui'
import { ReportView } from '../components/report/ReportView'
import { RedesignStudio } from '../components/RedesignStudio'
import { call, mediaUrl } from '../lib/api'
import { formatDateTime } from '../lib/format'
import { useAppStore } from '../store/useAppStore'
import type { AnalysisDetailDTO } from '@shared/ipc'

export function AnalysisPage(): React.JSX.Element {
  const { analysisId = '' } = useParams()
  const toast = useAppStore((s) => s.toast)
  const [detail, setDetail] = useState<AnalysisDetailDTO | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [tab, setTab] = useState('report')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    const data = await call(window.api.analysis.detail(analysisId))
    setDetail(data)
    setSelectedIds(data.selectedRecommendationIds)
    if (data.status === 'running' && !pollRef.current) {
      pollRef.current = setInterval(async () => {
        const current = await call(window.api.analysis.detail(analysisId)).catch(() => null)
        if (!current) return
        setDetail(current)
        if (current.status !== 'running' && pollRef.current) {
          clearInterval(pollRef.current)
          pollRef.current = null
        }
      }, 5000)
    }
    if (data.status !== 'running' && pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [analysisId])

  useEffect(() => {
    void load().catch((error) => toast('error', error instanceof Error ? error.message : 'Chargement impossible.'))
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [load, toast])

  const toggleRecommendation = async (id: string): Promise<void> => {
    const next = selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]
    setSelectedIds(next)
    try {
      await call(window.api.analysis.selectRecommendations(analysisId, next))
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Mise à jour impossible.')
    }
  }

  if (!detail) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    )
  }

  const running = detail.status === 'running'

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <Link to={`/projects/${detail.projectId}`} className="inline-flex items-center gap-1.5 text-xs text-ink-dim hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Retour au projet
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-ink">
              {detail.productSummary ?? `Analyse ${detail.id.slice(0, 8)}`}
            </h1>
            <Badge tone={detail.status === 'completed' ? 'ok' : detail.status === 'failed' ? 'danger' : 'accent'}>
              {detail.status === 'completed' ? 'Terminée' : detail.status === 'failed' ? 'Échec' : 'En cours'}
            </Badge>
          </div>
          <p className="text-sm text-ink-dim">
            {formatDateTime(detail.createdAt)} · {detail.model} · protocole {detail.protocolVersion}
          </p>
        </div>
        {detail.report && !running ? (
          <div className="flex items-center gap-4">
            <div className="text-right">
              <Badge tone="accent">
                Indice Félicité : {detail.report.felicityIndex.value === null ? '—' : detail.report.felicityIndex.value}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                icon={<ImageDown className="h-4 w-4" />}
                onClick={() => setTab('redesign')}
              >
                Redesign
              </Button>
              <Button
                variant="outline"
                icon={<FlaskConical className="h-4 w-4" />}
                onClick={() => window.location.hash = `#/projects/${detail.projectId}`}
              >
                Expérience
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {detail.image ? (
        <Card className="flex items-start gap-4 p-4">
          <img src={mediaUrl(detail.image.id)} alt={detail.image.fileName} className="h-40 w-40 shrink-0 rounded-lg border border-line bg-panel-2 object-contain" />
          <div className="min-w-0 text-sm text-ink-dim">
            <p className="truncate font-medium text-ink">{detail.image.fileName}</p>
            <p className="mt-1 text-xs">{detail.image.width}×{detail.image.height} · {detail.image.mimeType}</p>
            <p className="mt-2 text-xs text-ink-faint">
              L’image analysée vous appartient : elle reste dans votre dossier de données local. La transmission vers Gemini n’a
              lieu qu’avec votre consentement (voir Paramètres).
            </p>
          </div>
        </Card>
      ) : null}

      {detail.status === 'failed' ? (
        <Card className="border-danger/40 bg-danger/5">
          <p className="text-sm text-danger">L’analyse a échoué{detail.errorCode ? ` (${detail.errorCode})` : ''}. Vous pouvez relancer une analyse depuis le projet.</p>
        </Card>
      ) : null}

      {running ? (
        <Card>
          <div className="flex items-center gap-3">
            <Spinner />
            <p className="text-sm text-ink-dim">Analyse en cours dans le processus principal… la page se met à jour automatiquement.</p>
          </div>
        </Card>
      ) : null}

      {detail.status === 'completed' && detail.report ? (
        <>
          <Tabs
            value={tab}
            onValueChange={setTab}
            items={[
              { value: 'report', label: 'Rapport complet', count: detail.report.priorityRecommendations.length },
              { value: 'redesign', label: 'Redesign', count: detail.selectedRecommendationIds.length }
            ]}
          >
            <TabsContent value="report">
              <ReportView report={detail.report} selectedIds={selectedIds} onToggleRecommendation={(id) => void toggleRecommendation(id)} />
            </TabsContent>
            <TabsContent value="redesign">
              <RedesignStudio
                projectId={detail.projectId}
                analysisId={detail.id}
                sourceImageId={detail.image?.id ?? ''}
                recommendedIds={selectedIds}
                onVariantCreated={() => void load()}
              />
            </TabsContent>
          </Tabs>
        </>
      ) : null}

      {detail.status === 'completed' && !detail.report ? (
        <EmptyState title="Rapport indisponible" description="Le rapport n’a pas pu être reconstruit. Réessayez une analyse." />
      ) : null}
    </div>
  )
}