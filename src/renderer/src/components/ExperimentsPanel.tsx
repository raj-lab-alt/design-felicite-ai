import { useCallback, useEffect, useState } from 'react'
import { FlaskConical, Plus, Trash2 } from 'lucide-react'
import { Badge, Button, Card, CardHeader, Dialog, EmptyState, Field, Input, Select, Spinner, Textarea } from './ui'
import { call } from '../lib/api'
import { useAppStore } from '../store/useAppStore'
import type { ExperimentDTO, ExperimentSummaryDTO, ExperimentResultDTO, VariantDTO } from '@shared/ipc'
import type { ExperimentMetric, ExperimentResultInput } from '@shared/schemas'

const METRIC_LABELS: Record<ExperimentMetric, string> = {
  ctr: 'Taux de clic (CTR)',
  cost_per_visit: 'Coût par visite',
  cost_per_qualified_conversation: 'Coût par conversation qualifiée',
  conversion_rate: 'Taux de conversion',
  cost_per_confirmed_order: 'Coût par commande confirmée',
  delivery_confirmation_rate: 'Taux de confirmation de livraison',
  other: 'Autre'
}

const VERDICT_LABELS: Record<ExperimentSummaryDTO['verdict'], { label: string; tone: 'ok' | 'warn' | 'danger' | 'neutral' }> = {
  insufficient_data: { label: 'Données insuffisantes', tone: 'warn' },
  variant_a: { label: 'Variante A gagnante', tone: 'ok' },
  variant_b: { label: 'Variante B gagnante', tone: 'ok' },
  original: { label: 'Original gagnant', tone: 'neutral' },
  no_difference: { label: 'Aucune différence mesurée', tone: 'warn' }
}

const variantOptions = (variants: VariantDTO[]) => [
  { value: '', label: 'Non relié' },
  ...variants.map((v) => ({ value: v.id, label: `Variante ${v.id.slice(0, 8)} (${v.mode})` }))
]

export function ExperimentsPanel({
  projectId,
  variants,
  onVariantsChanged
}: {
  projectId: string
  variants: VariantDTO[]
  onVariantsChanged: () => void
}): React.JSX.Element {
  const toast = useAppStore((s) => s.toast)
  const [experiments, setExperiments] = useState<ExperimentDTO[] | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', hypothesis: '', variantAId: '', variantBId: '', audience: '', channel: '', primaryMetric: 'ctr' as ExperimentMetric, notes: '' })
  const [resultsFor, setResultsFor] = useState<ExperimentDTO | null>(null)
  const [resultForm, setResultForm] = useState<ExperimentResultInput>({ variant: 'A', metric: 'ctr', value: 0, sampleSize: null, source: 'manuel', note: '' })
  const [summaries, setSummaries] = useState<Record<string, ExperimentSummaryDTO>>({})
  const [results, setResults] = useState<Record<string, ExperimentResultDTO[]>>({})

  const load = useCallback(async () => {
    try {
      const list = await call(window.api.experiments.list(projectId))
      setExperiments(list)
      const summaryMap: Record<string, ExperimentSummaryDTO> = {}
      const resultMap: Record<string, ExperimentResultDTO[]> = {}
      await Promise.all(
        list.map(async (exp) => {
          summaryMap[exp.id] = await call(window.api.experiments.summary(exp.id))
          resultMap[exp.id] = await call(window.api.experiments.results(exp.id))
        })
      )
      setSummaries(summaryMap)
      setResults(resultMap)
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Chargement impossible.')
    }
  }, [projectId, toast])

  useEffect(() => {
    void load()
  }, [load])

  const create = async (): Promise<void> => {
    if (!form.name.trim()) return
    setCreating(true)
    try {
      await call(
        window.api.experiments.create({
          projectId,
          name: form.name.trim(),
          hypothesis: form.hypothesis,
          variantAId: form.variantAId || null,
          variantBId: form.variantBId || null,
          audience: form.audience,
          channel: form.channel,
          primaryMetric: form.primaryMetric,
          notes: form.notes
        })
      )
      setCreateOpen(false)
      setForm({ name: '', hypothesis: '', variantAId: '', variantBId: '', audience: '', channel: '', primaryMetric: 'ctr', notes: '' })
      toast('success', 'Expérience créée.')
      void load()
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Création impossible.')
    } finally {
      setCreating(false)
    }
  }

  const addResult = async (): Promise<void> => {
    if (!resultsFor) return
    try {
      await call(window.api.experiments.addResult(resultsFor.id, resultForm))
      setResultsFor(null)
      toast('success', 'Résultat enregistré.')
      void load()
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Enregistrement impossible.')
    }
  }

  const remove = async (id: string): Promise<void> => {
    try {
      await call(window.api.experiments.remove(id))
      toast('success', 'Expérience supprimée.')
      onVariantsChanged()
      void load()
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Suppression impossible.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-ink-dim">
          Comparez les performances réelles (canal utilisé, coûts publicitaires, ventes) entre l’original et vos variantes.
        </p>
        <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
          Nouvelle expérience
        </Button>
      </div>

      {experiments === null ? (
        <Spinner />
      ) : experiments.length === 0 ? (
        <EmptyState
          icon={<FlaskConical className="h-8 w-8" />}
          title="Aucune expérience"
          description="Créez une expérience pour relier l’original et une variante à des résultats mesurés sur le terrain."
          action={
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
              Créer une expérience
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {experiments.map((exp) => {
            const summary = summaries[exp.id]
            const expResults = results[exp.id] ?? []
            return (
              <Card key={exp.id}>
                <CardHeader
                  title={
                    <span className="flex items-center gap-2">
                      {exp.name}
                      {summary ? <Badge tone={VERDICT_LABELS[summary.verdict].tone}>{VERDICT_LABELS[summary.verdict].label}</Badge> : null}
                    </span>
                  }
                  subtitle={`Métrique : ${METRIC_LABELS[exp.primaryMetric]} · Canal : ${exp.channel || 'non précisé'}`}
                  actions={
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => { setResultsFor(exp); setResultForm({ variant: 'A', metric: exp.primaryMetric, value: 0, sampleSize: null, source: 'manuel', note: '' }) }}>
                        Résultat
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        icon={<Trash2 className="h-3.5 w-3.5" />}
                        onClick={() => {
                          if (confirm('Supprimer cette expérience ?')) void remove(exp.id)
                        }}
                      />
                    </div>
                  }
                />
                {summary ? (
                  <div className="mb-3 rounded-lg bg-panel-2 p-3 text-xs text-ink-dim">
                    {summary.message}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {summary.perVariant.map((pv) => (
                        <Badge key={pv.variant} tone={pv.variant === 'A' ? 'info' : pv.variant === 'B' ? 'accent' : 'neutral'}>
                          {pv.variant === 'original' ? 'Original' : `Variante ${pv.variant}`} :{' '}
                          {pv.average === null ? '—' : pv.average.toFixed(3)} ({pv.samples} relevé(s))
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
                {expResults.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {expResults.map((r) => (
                      <Badge key={r.id} tone="neutral">
                        {r.variant === 'original' ? 'Original' : `V${r.variant}`} · {r.value} ({r.sampleSize ?? 'n/a'}) · {r.source}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </Card>
            )
          })}
        </div>
      )}

      <Dialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Nouvelle expérience"
        description="L’outil reste honnête : sans assez de données, aucun gagnant n’est déclaré."
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button loading={creating} disabled={!form.name.trim()} onClick={() => void create()}>
              Créer
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nom" required className="sm:col-span-2">
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="Hypothèse" className="sm:col-span-2">
            <Textarea value={form.hypothesis} onChange={(e) => setForm((f) => ({ ...f, hypothesis: e.target.value }))} />
          </Field>
          <Field label="Variante A">
            <Select options={variantOptions(variants)} value={form.variantAId} onValueChange={(value) => setForm((f) => ({ ...f, variantAId: value }))} />
          </Field>
          <Field label="Variante B">
            <Select options={variantOptions(variants)} value={form.variantBId} onValueChange={(value) => setForm((f) => ({ ...f, variantBId: value }))} />
          </Field>
          <Field label="Audience">
            <Input value={form.audience} onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))} />
          </Field>
          <Field label="Canal">
            <Input value={form.channel} onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))} />
          </Field>
          <Field label="Métrique principale" className="sm:col-span-2">
            <Select
              options={(Object.keys(METRIC_LABELS) as ExperimentMetric[]).map((m) => ({ value: m, label: METRIC_LABELS[m] }))}
              value={form.primaryMetric}
              onValueChange={(value) => setForm((f) => ({ ...f, primaryMetric: value as ExperimentMetric }))}
            />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </Field>
        </div>
      </Dialog>

      <Dialog
        open={resultsFor !== null}
        onOpenChange={(open) => (open ? null : setResultsFor(null))}
        title={resultsFor ? `Ajouter un résultat — ${resultsFor.name}` : ''}
        footer={
          <>
            <Button variant="outline" onClick={() => setResultsFor(null)}>
              Annuler
            </Button>
            <Button
              onClick={() => void addResult()}
              disabled={!Number.isFinite(resultForm.value) || (resultForm.sampleSize !== null && Number.isFinite(resultForm.sampleSize) === false)}
            >
              Enregistrer
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Variante" required>
            <Select
              options={[
                { value: 'original', label: 'Original' },
                { value: 'A', label: 'Variante A' },
                { value: 'B', label: 'Variante B' }
              ]}
              value={resultForm.variant}
              onValueChange={(value) => setResultForm((f) => ({ ...f, variant: value as ExperimentResultInput['variant'] }))}
            />
          </Field>
          <Field label="Métrique">
            <Select
              options={(Object.keys(METRIC_LABELS) as ExperimentMetric[]).map((m) => ({ value: m, label: METRIC_LABELS[m] }))}
              value={resultForm.metric}
              onValueChange={(value) => setResultForm((f) => ({ ...f, metric: value as ExperimentMetric }))}
            />
          </Field>
          <Field label="Valeur" required>
            <Input
              type="number"
              step="any"
              value={String(resultForm.value)}
              onChange={(e) => setResultForm((f) => ({ ...f, value: Number(e.target.value) }))}
            />
          </Field>
          <Field label="Nombre d’observations" hint="optionnel">
            <Input
              type="number"
              value={resultForm.sampleSize ?? ''}
              onChange={(e) => setResultForm((f) => ({ ...f, sampleSize: e.target.value ? Number(e.target.value) : null }))}
            />
          </Field>
          <Field label="Source" className="sm:col-span-2">
            <Input value={resultForm.source} onChange={(e) => setResultForm((f) => ({ ...f, source: e.target.value }))} />
          </Field>
          <Field label="Note" className="sm:col-span-2">
            <Textarea value={resultForm.note} onChange={(e) => setResultForm((f) => ({ ...f, note: e.target.value }))} />
          </Field>
        </div>
      </Dialog>
    </div>
  )
}