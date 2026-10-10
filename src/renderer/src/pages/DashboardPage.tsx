import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FolderPlus, ImagePlus, KeyRound, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Spinner
} from '../components/ui/primitives'
import { OpenDataDirButton } from '../components/layout/Shell'
import { call } from '../lib/api'
import { formatCost, formatDate } from '../lib/format'
import { useAppStore } from '../store/useAppStore'
import type { ProjectDTO, UsageSummaryDTO } from '@shared/ipc'

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }): React.JSX.Element {
  return (
    <Card className="flex-1 py-4">
      <p className="text-[11px] uppercase tracking-wider text-ink-faint">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-ink">{value}</p>
      {sub ? <p className="mt-0.5 text-[11px] text-ink-dim">{sub}</p> : null}
    </Card>
  )
}

export function DashboardPage(): React.JSX.Element {
  const navigate = useNavigate()
  const settings = useAppStore((s) => s.settings)
  const secrets = useAppStore((s) => s.secrets)
  const toast = useAppStore((s) => s.toast)
  const [projects, setProjects] = useState<ProjectDTO[] | null>(null)
  const [usage, setUsage] = useState<UsageSummaryDTO | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const [recent, usageData] = await Promise.all([
          call(window.api.projects.recent(5)),
          call(window.api.usage.summary())
        ])
        setProjects(recent)
        setUsage(usageData)
      } catch (error) {
        toast('error', error instanceof Error ? error.message : 'Chargement impossible.')
      }
    })()
  }, [toast])

  const needSetup = !secrets?.configured || (settings !== null && !settings.privacyConsentGivenAt)

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink">Bienvenue</h1>
          <p className="text-sm text-ink-dim">
            Analysez vos designs commerciaux, obtenez un Indice Félicité et générez des redesigns fidèles.
          </p>
        </div>
        <OpenDataDirButton />
      </div>

      {needSetup ? (
        <Card className="flex items-start gap-4 border-accent/40 bg-accent/10">
          <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-ink">Configuration requise</h2>
            <p className="mt-1 text-xs text-ink-dim">
              {!secrets?.configured
                ? 'Ajoutez votre clé API Gemini et acceptez le consentement de confidentialité pour envoyer vos images au service.'
                : 'Acceptez le consentement de confidentialité avant d’analyser vos images.'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => navigate('/settings')}>
                Configurer
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <StatCard label="Projets" value={projects ? String(projects.length) : '—'} />
        <StatCard label="Analyses" value={usage ? String(usage.analysisCount) : '—'} />
        <StatCard
          label="Coût estimé"
          value={usage ? formatCost(usage.estimatedCostUsd) : '—'}
          sub="estimation locale uniquement"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Projets récents"
            subtitle="Vos derniers projets de design"
            actions={
              <Button variant="outline" size="sm" onClick={() => navigate('/library')}>
                Tout voir
              </Button>
            }
          />
          {projects === null ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : projects.length === 0 ? (
            <EmptyState
              icon={<Sparkles className="h-8 w-8" />}
              title="Aucun projet pour l’instant"
              description="Créez un projet puis importez une image de design pour lancer une analyse."
              action={
                <Button onClick={() => navigate('/library')} icon={<FolderPlus className="h-4 w-4" />}>
                  Créer un projet
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-line-soft">
              {projects.map((project) => (
                <li key={project.id}>
                  <Link
                    to={`/projects/${project.id}`}
                    className="flex items-center justify-between gap-4 rounded-lg px-2 py-3 transition-colors hover:bg-panel-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-ink">{project.name}</span>
                        {project.favorite ? <Badge tone="warn">Favori</Badge> : null}
                      </div>
                      <p className="mt-0.5 text-xs text-ink-dim">
                        {project.imageCount} image(s) · {project.analysisCount} analyse(s) ·{' '}
                        {project.variantCount} variante(s)
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-ink-faint">{formatDate(project.updatedAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Actions rapides" />
          <div className="flex flex-col gap-2">
            <Button variant="secondary" icon={<FolderPlus className="h-4 w-4" />} onClick={() => navigate('/library')}>
              Nouveau projet
            </Button>
            <Button
              variant="secondary"
              icon={<ImagePlus className="h-4 w-4" />}
              onClick={() => navigate('/library')}
              disabled={needSetup}
              title="Configurez d’abord l’API Gemini"
            >
              Analyser un design
            </Button>
            <Button variant="ghost" icon={<ShieldCheck className="h-4 w-4" />} onClick={() => navigate('/settings')}>
              Paramètres & confidentialité
            </Button>
            <Button variant="ghost" icon={<TrendingUp className="h-4 w-4" />} onClick={() => navigate('/diagnostics')}>
              Diagnostics & sauvegardes
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}