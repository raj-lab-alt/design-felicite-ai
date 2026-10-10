import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FolderPlus, FolderSearch, Search } from 'lucide-react'
import { Badge, Button, Card, EmptyState, Input, Spinner, Field } from '../components/ui/primitives'
import { Dialog } from '../components/ui'
import { call } from '../lib/api'
import { formatDate } from '../lib/format'
import { useAppStore } from '../store/useAppStore'
import type { ProjectDTO } from '@shared/ipc'

export function LibraryPage(): React.JSX.Element {
  const toast = useAppStore((s) => s.toast)
  const navigate = useNavigate()
  const [projects, setProjects] = useState<ProjectDTO[] | null>(null)
  const [query, setQuery] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(
    async (search?: string) => {
      try {
        const data = search && search.trim() ? await call(window.api.library.search(search)) : await call(window.api.projects.list())
        setProjects(data)
      } catch (error) {
        toast('error', error instanceof Error ? error.message : 'Impossible de charger les projets.')
      }
    },
    [toast]
  )

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const timer = setTimeout(() => void load(query), 300)
    return () => clearTimeout(timer)
  }, [query, load])

  const createProject = async (): Promise<void> => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const project = await call(window.api.projects.create({ name: newName.trim() }))
      setCreateOpen(false)
      setNewName('')
      toast('success', 'Projet créé.')
      navigate(`/projects/${project.id}`)
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Création impossible.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Bibliothèque</h1>
          <p className="text-sm text-ink-dim">Tous vos projets, analyses et redesigns.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <Input
              className="w-64 pl-9"
              placeholder="Rechercher un projet…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Button icon={<FolderPlus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
            Nouveau projet
          </Button>
        </div>
      </div>

      {projects === null ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={<FolderSearch className="h-8 w-8" />}
          title={query ? 'Aucun projet ne correspond' : 'Aucun projet'}
          description={
            query
              ? `Aucun résultat pour « ${query} ».`
              : 'Créez votre premier projet pour importer des designs et lancer une analyse.'
          }
          action={
            !query ? (
              <Button icon={<FolderPlus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
                Nouveau projet
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} to={`/projects/${project.id}`}>
              <Card className="h-full transition-colors hover:border-accent/50">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-ink">{project.name}</h3>
                    <p className="mt-0.5 text-xs text-ink-dim">Créé le {formatDate(project.createdAt)}</p>
                  </div>
                  {project.favorite ? <Badge tone="warn">★</Badge> : null}
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  <Badge>{project.imageCount} images</Badge>
                  <Badge tone="accent">{project.analysisCount} analyses</Badge>
                  <Badge tone="info">{project.variantCount} variantes</Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Nouveau projet"
        description="Créez un projet pour organiser images, analyses et variantes."
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button loading={creating} disabled={!newName.trim()} onClick={() => void createProject()}>
              Créer
            </Button>
          </>
        }
      >
        <Field label="Nom du projet" required>
          <Input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void createProject()
            }}
            placeholder="Ex. : Bougies artisanales 2026"
          />
        </Field>
      </Dialog>
    </div>
  )
}