import { useEffect, useState } from 'react'
import { ImageDown, Lightbulb, RefreshCcw, Sparkles } from 'lucide-react'
import { Badge, Button, Card, Field, ProgressBar, Select, Spinner, Textarea } from './ui'
import { call, mediaUrl } from '../lib/api'
import { useAppStore } from '../store/useAppStore'
import type { VariantDTO, RedesignPromptDTO } from '@shared/ipc'
import type { RedesignMode } from '@shared/schemas'

export function RedesignStudio({
  projectId,
  analysisId,
  sourceImageId,
  recommendedIds,
  onVariantCreated
}: {
  projectId: string
  analysisId: string
  sourceImageId: string
  recommendedIds: string[]
  onVariantCreated: () => void
}): React.JSX.Element {
  const toast = useAppStore((s) => s.toast)
  const settings = useAppStore((s) => s.settings)
  const [mode, setMode] = useState<RedesignMode>('faithful')
  const [prompt, setPrompt] = useState('')
  const [autoPrompt, setAutoPrompt] = useState<RedesignPromptDTO | null>(null)
  const [building, setBuilding] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [progress, setProgress] = useState({ progress: 0, message: 'Préparation…', stage: '' })
  const [last, setLast] = useState<VariantDTO | null>(null)

  useEffect(() => {
    if (!generating) return
    const off = window.api.events.onRedesignProgress((event) => {
      if (!jobId || event.jobId === jobId) setJobId(event.jobId)
      setProgress({ progress: event.progress, message: event.message, stage: event.stage })
    })
    return off
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generating])

  const build = async (): Promise<void> => {
    setBuilding(true)
    try {
      const built = await call(
        window.api.redesign.buildPrompt({
          projectId,
          analysisId,
          sourceImageId,
          mode,
          selectedRecommendationIds: recommendedIds,
          extraInstruction: ''
        })
      )
      setAutoPrompt(built)
      setPrompt(built.prompt)
      if (built.warnings.length > 0) toast('info', built.warnings.join(' '))
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Construction du prompt impossible.')
    } finally {
      setBuilding(false)
    }
  }

  const generate = async (): Promise<void> => {
    setGenerating(true)
    setJobId(null)
    setLast(null)
    setProgress({ progress: 5, message: 'Préparation…', stage: 'prepare' })
    try {
      const variant = await call(
        window.api.redesign.generate({
          projectId,
          analysisId,
          sourceImageId,
          mode,
          selectedRecommendationIds: recommendedIds,
          extraInstruction: '',
          workingPrompt: prompt.trim() || undefined
        })
      )
      setLast(variant)
      if (variant.status === 'completed') {
        toast('success', 'Variante générée.')
        onVariantCreated()
      } else {
        toast('info', 'Génération indisponible : le prompt de redesign a été enregistré pour un usage futur.')
        onVariantCreated()
      }
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Génération impossible.')
    } finally {
      setGenerating(false)
    }
  }

  const cancel = async (): Promise<void> => {
    if (!jobId) return
    await call(window.api.redesign.cancel(jobId)).catch(() => undefined)
    setGenerating(false)
    toast('info', 'Génération annulée.')
  }

  const generationEnabled = settings?.imageGenerationEnabled ?? false

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-accent/15 p-2 text-accent">
            <Lightbulb className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-ink">Studio de redesign</h4>
            <p className="mt-0.5 text-xs text-ink-dim">
              Construisez un prompt fidèle au design analysé, puis générez une variante. L’original n’est jamais modifié : chaque
              variante est un nouvel essai.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Style de redesign">
            <Select
              options={[
                { value: 'faithful', label: 'Fidèle (rester proche de l’original)' },
                { value: 'premium', label: 'Premium (raffiner sans dénaturer)' }
              ]}
              value={mode}
              onValueChange={(value) => setMode(value as RedesignMode)}
            />
          </Field>
          <div className="flex items-end gap-2">
            <Button variant="outline" loading={building} icon={<Sparkles className="h-4 w-4" />} onClick={() => void build()}>
              Construire le prompt
            </Button>
            {autoPrompt ? <Badge tone="info">4 recommandations incluses</Badge> : null}
          </div>
        </div>

        <Field
          label="Prompt de redesign"
          hint={autoPrompt ? 'généré automatiquement, modifiable' : 'cliquez « Construire le prompt » pour un départ automatique'}
        >
          <Textarea
            className="min-h-44 font-mono text-xs"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Le prompt est construit automatiquement depuis le brief du rapport d’analyse…"
          />
        </Field>

        {!generationEnabled ? (
          <p className="rounded-lg bg-warn/10 p-3 text-xs text-warn">
            La génération d’images est désactivée dans les Paramètres. Vous pouvez quand même construire un prompt de redesign : il
            sera enregistré pour un usage ultérieur.
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-ink-faint">
            Modèle d’image : {settings?.imageModels?.[0] ?? '—'} · coût indicatif par essai :{' '}
            {settings ? `$ ${((settings.imagePricePerImage ?? 0.04) * 100).toFixed(4)} c` : '—'}
            {' '}· votre clé API reste sur votre machine.
          </p>
          {generating ? (
            <Button variant="danger" icon={<RefreshCcw className="h-4 w-4" />} onClick={() => void cancel()}>
              Annuler
            </Button>
          ) : (
            <Button icon={<ImageDown className="h-4 w-4" />} onClick={() => void generate()}>
              Générer une variante
            </Button>
          )}
        </div>

        {generating ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-ink-dim">
              <span>{progress.message}</span>
              <span>{Math.round(progress.progress)} %</span>
            </div>
            <ProgressBar value={progress.progress} />
          </div>
        ) : null}
      </Card>

      {last ? (
        <Card className="space-y-3">
          <h4 className="text-sm font-semibold text-ink">Dernière variante</h4>
          {last.image ? (
            <img src={mediaUrl(last.image.id)} alt="Variante générée" className="max-h-96 w-full rounded-lg border border-line bg-panel-2 object-contain" />
          ) : (
            <div className="rounded-lg bg-panel-2 p-4 text-xs text-ink-dim">
              {last.status === 'failed'
                ? 'La génération n’a pas abouti (prompt conservé). Vous pouvez retenter en activant la génération d’images.'
                : 'Aucune image disponible pour le moment.'}
            </div>
          )}
          {last.errorCode ? <Badge tone="danger">{last.errorCode}</Badge> : null}
        </Card>
      ) : null}

      {generating ? (
        <div className="flex justify-center py-4">
          <Spinner />
        </div>
      ) : null}
    </div>
  )
}