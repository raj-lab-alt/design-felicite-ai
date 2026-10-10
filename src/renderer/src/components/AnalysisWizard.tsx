import { useEffect, useState } from 'react'
import { RefreshCcw } from 'lucide-react'
import { Button, Dialog, Field, Input, ProgressBar, Select, Textarea } from './ui'
import { call } from '../lib/api'
import { useAppStore } from '../store/useAppStore'
import { PRODUCT_CATEGORIES, CHANNELS } from '@shared/constants'
import type { AnalysisContext, BrandProfile } from '@shared/schemas'
import type { AnalysisProgressEvent, ImageDTO } from '@shared/ipc'

const objectives = [
  { value: 'vente', label: 'Vendre le produit (conversion)' },
  { value: 'notoriete', label: 'Faire connaître la marque (notoriété)' },
  { value: 'premium', label: 'Affirmer un positionnement premium' },
  { value: 'lancement', label: 'Lancer un nouveau produit' },
  { value: 'autre', label: 'Autre' }
]

function emptyContext(): AnalysisContext {
  return {
    productName: '',
    categoryId: '',
    price: '',
    market: '',
    audience: '',
    channelId: '',
    objective: undefined,
    promise: '',
    positioning: '',
    constraints: '',
    competitors: '',
    description: ''
  }
}

export function AnalysisWizard({
  open,
  onClose,
  projectId,
  image,
  onRun
}: {
  open: boolean
  onClose: () => void
  projectId: string
  image: ImageDTO
  onRun: (analysisId: string) => void
}): React.JSX.Element {
  const toast = useAppStore((s) => s.toast)
  const [context, setContext] = useState<AnalysisContext>(emptyContext())
  const [profiles, setProfiles] = useState<BrandProfile[]>([])
  const [brandProfileId, setBrandProfileId] = useState<string>('')
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<AnalysisProgressEvent | null>(null)

  useEffect(() => {
    if (!open) return
    setRunning(false)
    setProgress(null)
    setContext(emptyContext())
    void call(window.api.profiles.list())
      .then((list) => setProfiles(list))
      .catch(() => setProfiles([]))
  }, [open])

  const set = <K extends keyof AnalysisContext>(key: K, value: AnalysisContext[K]): void => {
    setContext((c) => ({ ...c, [key]: value }))
  }

  const start = async (): Promise<void> => {
    setRunning(true)
    setProgress({ analysisId: '', stage: 'connecting', progress: 3, message: 'Préparation de l’analyse…' })
    const cleaned = { ...context }
    for (const key of Object.keys(cleaned)) {
      const typed = key as keyof AnalysisContext
      if (typeof cleaned[typed] === 'string' && !(cleaned[typed] as string).trim()) {
        cleaned[typed] = undefined as never
      }
    }
    const res = await window.api.analysis.run({
      projectId,
      imageId: image.id,
      context: { ...cleaned, objective: cleaned.objective || undefined },
      brandProfileId: brandProfileId || null
    })
    if (!res.ok || !res.data) {
      setRunning(false)
      toast('error', res.ok ? 'Analyse impossible.' : res.error.userMessage)
      return
    }
    toast('success', 'Analyse lancée.')
    onRun(res.data.id)
  }

  useEffect(() => {
    if (!running) return
    const off = window.api.events.onAnalysisProgress((event) => setProgress(event))
    return off
  }, [running])

  return (
    <Dialog
      open={open}
      onOpenChange={() => (running ? null : onClose())}
      title={running ? 'Analyse en cours' : 'Nouvelle analyse'}
      description={
        running
          ? 'L’analyse multimodale peut prendre de 20 secondes à 2 minutes.'
          : `Analyse de l’image « ${image.fileName} ». L’image n’est envoyée vers le service Gemini qu’avec votre autorisation.`
      }
      width="max-w-2xl"
      footer={
        running
          ? [
              <Button
                key="cancel"
                variant="danger"
                icon={<RefreshCcw className="h-4 w-4" />}
                onClick={() => void call(window.api.analysis.cancel(progress?.analysisId ?? '')).then(() => setRunning(false))}
              >
                Annuler
              </Button>
            ]
          : [
              <Button key="close" variant="outline" onClick={onClose}>
                Fermer
              </Button>,
              <Button key="start" onClick={() => void start()}>
                Lancer l’analyse
              </Button>
            ]
      }
    >
      {running ? (
        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between text-xs text-ink-dim">
            <span>{progress?.stage === 'connecting' ? 'Connexion…' : progress?.message ?? 'Analyse en cours…'}</span>
            <span>{Math.round(progress?.progress ?? 0)} %</span>
          </div>
          <ProgressBar value={progress?.progress ?? 0} />
          <p className="text-xs text-ink-faint">
            L’analyse reste strictement à des fins de diagnostic visuel. Vous pouvez repartir de l’original à tout moment ;
            aucune promesse de vente n’est garantie.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nom du produit" hint="optionnel">
            <Input value={context.productName ?? ''} onChange={(e) => set('productName', e.target.value)} />
          </Field>
          <Field label="Catégorie" hint="laissée à l’IA si vide">
            <Select
              options={[{ value: '', label: 'Laisser l’IA inférer' }, ...PRODUCT_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))]}
              value={context.categoryId ?? ''}
              onValueChange={(value) => set('categoryId', value || undefined)}
            />
          </Field>
          <Field label="Prix de vente" hint="optionnel">
            <Input value={context.price ?? ''} onChange={(e) => set('price', e.target.value)} placeholder="Ex. : 24 € TTC" />
          </Field>
          <Field label="Marché / pays" hint="optionnel">
            <Input value={context.market ?? ''} onChange={(e) => set('market', e.target.value)} />
          </Field>
          <Field label="Canal de diffusion" hint="optionnel">
            <Select
              options={[{ value: '', label: 'Non précisé' }, ...CHANNELS.map((c) => ({ value: c.id, label: c.label }))]}
              value={context.channelId ?? ''}
              onValueChange={(value) => set('channelId', value || undefined)}
            />
          </Field>
          <Field label="Objectif commercial" hint="optionnel">
            <Select
              options={[{ value: '', label: 'Non précisé' }, ...objectives]}
              value={context.objective ?? ''}
              onValueChange={(value) => set('objective', (value || undefined) as AnalysisContext['objective'])}
            />
          </Field>
          <Field label="Audience cible" hint="optionnel" className="sm:col-span-2">
            <Textarea value={context.audience ?? ''} onChange={(e) => set('audience', e.target.value)} placeholder="Qui achète ?" />
          </Field>
          <Field label="Promesse marketing" hint="optionnel" className="sm:col-span-2">
            <Textarea value={context.promise ?? ''} onChange={(e) => set('promise', e.target.value)} />
          </Field>
          <Field label="Positionnement / ton" hint="optionnel" className="sm:col-span-2">
            <Textarea value={context.positioning ?? ''} onChange={(e) => set('positioning', e.target.value)} />
          </Field>
          <Field label="Contraintes techniques" hint="optionnel" className="sm:col-span-2">
            <Textarea value={context.constraints ?? ''} onChange={(e) => set('constraints', e.target.value)} placeholder="Matériaux, procédés, délais…" />
          </Field>
          <Field label="Concurrents référents" hint="optionnel" className="sm:col-span-2">
            <Textarea value={context.competitors ?? ''} onChange={(e) => set('competitors', e.target.value)} />
          </Field>
          {profiles.length > 0 ? (
            <Field label="Profil de marque" hint="avec votre autorisation" className="sm:col-span-2">
              <Select
                options={[{ value: '', label: 'Aucun' }, ...profiles.map((p) => ({ value: p.id, label: p.name }))]}
                value={brandProfileId}
                onValueChange={setBrandProfileId}
              />
            </Field>
          ) : null}
        </div>
      )}
    </Dialog>
  )
}