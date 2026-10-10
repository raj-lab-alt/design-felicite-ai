import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Download,
  Eye,
  FolderPlus,
  Image as ImageIcon,
  Pencil,
  Star,
  Trash2,
  Upload
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  Field,
  Input,
  Spinner,
  Tabs,
  TabsContent
} from '../components/ui'
import { AnalysisWizard } from '../components/AnalysisWizard'
import { ExperimentsPanel } from '../components/ExperimentsPanel'
import { call, mediaUrl } from '../lib/api'
import { formatBytes, formatDate, formatDateTime } from '../lib/format'
import { useAppStore } from '../store/useAppStore'
import type { ExportDTO, ImageDTO, VariantDTO, AnalysisSummaryDTO, ProjectDTO } from '@shared/ipc'

type TabId = 'images' | 'analyses' | 'variants' | 'experiments' | 'exports'

const roleLabels: Record<string, { label: string; tone: 'neutral' | 'accent' | 'info' }> = {
  original: { label: 'Original', tone: 'neutral' },
  reference: { label: 'Référence', tone: 'info' },
  generated: { label: 'Générée', tone: 'accent' }
}

export function ProjectPage(): React.JSX.Element {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const toast = useAppStore((s) => s.toast)

  const [project, setProject] = useState<ProjectDTO | null>(null)
  const [images, setImages] = useState<ImageDTO[] | null>(null)
  const [analyses, setAnalyses] = useState<AnalysisSummaryDTO[] | null>(null)
  const [variants, setVariants] = useState<VariantDTO[] | null>(null)
  const [exports, setExports] = useState<ExportDTO[] | null>(null)
  const [tab, setTab] = useState<TabId>('images')
  const [wizardImage, setWizardImage] = useState<ImageDTO | null>(null)
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [lightbox, setLightbox] = useState<{ imageId: string; caption?: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const [projectData, imageList, analysisList, variantList, exportList] = await Promise.all([
        call(window.api.projects.get(projectId)),
        call(window.api.media.list(projectId)),
        call(window.api.analysis.byProject(projectId)),
        call(window.api.redesign.variantsByProject(projectId)),
        call(window.api.exports.list(projectId))
      ])
      setProject(projectData)
      setImages(imageList)
      setAnalyses(analysisList)
      setVariants(variantList)
      setExports(exportList)
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Impossible de charger le projet.')
      navigate('/library')
    }
  }, [projectId, navigate, toast])

  useEffect(() => {
    void load()
  }, [load])

  const importImages = async (): Promise<void> => {
    try {
      const imported = await call(window.api.media.importDialog(projectId))
      if (imported.length === 0) return
      toast('success', `${imported.length} image(s) importée(s).`)
      await load()
      setTab('images')
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Import impossible.')
    }
  }

  const removeImage = async (image: ImageDTO): Promise<void> => {
    try {
      await call(window.api.media.remove(image.id))
      toast('success', 'Image supprimée.')
      await load()
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Suppression impossible.')
    }
  }

  const saveRename = async (): Promise<void> => {
    if (!renameValue.trim()) return
    try {
      const updated = await call(window.api.projects.update({ id: projectId, name: renameValue.trim() }))
      setProject(updated)
      setRenameOpen(false)
      toast('success', 'Projet renommé.')
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Renommage impossible.')
    }
  }

  const toggleFavorite = async (): Promise<void> => {
    if (!project) return
    try {
      const updated = await call(window.api.projects.update({ id: projectId, favorite: !project.favorite }))
      setProject(updated)
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Mise à jour impossible.')
    }
  }

  const deleteProject = async (): Promise<void> => {
    try {
      await call(window.api.projects.delete(projectId))
      toast('success', 'Projet supprimé (les fichiers d’images restent sur votre disque).')
      navigate('/library')
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Suppression impossible.')
    }
  }

  const deleteAnalysis = async (analysisId: string): Promise<void> => {
    try {
      await call(window.api.analysis.delete(analysisId))
      toast('success', 'Analyse supprimée.')
      await load()
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Suppression impossible.')
    }
  }

  const deleteVariant = async (variantId: string): Promise<void> => {
    try {
      await call(window.api.redesign.deleteVariant(variantId))
      toast('success', 'Variante supprimée.')
      await load()
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Suppression impossible.')
    }
  }

  const createExport = async (analysisId: string, format: 'pdf' | 'json'): Promise<void> => {
    try {
      const created = await call(window.api.exports.create({ projectId, analysisId, format }))
      toast('success', 'Export créé.')
      await load()
      await call(window.api.exports.reveal(created.filePath))
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Export impossible.')
    }
  }

  if (!project) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    )
  }

  const completedAnalyses = (analyses ?? []).filter((a) => a.status === 'completed')

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link to="/library" className="mb-2 inline-flex items-center gap-1.5 text-xs text-ink-dim hover:text-ink">
            <ArrowLeft className="h-3.5 w-3.5" /> Bibliothèque
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-ink">{project.name}</h1>
            <button
              onClick={() => void toggleFavorite()}
              className="text-ink-faint transition-colors hover:text-warn"
              title="Ajouter aux favoris"
            >
              <Star className={project.favorite ? 'h-4 w-4 fill-warn text-warn' : 'h-4 w-4'} />
            </button>
          </div>
          <p className="text-sm text-ink-dim">
            {project.imageCount} image(s) · {project.analysisCount} analyse(s) · {project.variantCount} variante(s)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={<Pencil className="h-4 w-4" />}
            onClick={() => {
              setRenameValue(project.name)
              setRenameOpen(true)
            }}
          >
            Renommer
          </Button>
          <Button variant="outline" size="sm" icon={<Upload className="h-4 w-4" />} onClick={() => void importImages()}>
            Importer
          </Button>
          <Button
            variant="danger"
            size="sm"
            icon={<Trash2 className="h-4 w-4" />}
            onClick={() => {
              if (confirm(`Supprimer le projet « ${project.name} » ?`)) void deleteProject()
            }}
          >
            Supprimer
          </Button>
        </div>
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as TabId)}
        items={[
          { value: 'images', label: 'Images', count: images?.length },
          { value: 'analyses', label: 'Analyses', count: analyses?.length },
          { value: 'variants', label: 'Variantes', count: variants?.length },
          { value: 'experiments', label: 'Expériences' },
          { value: 'exports', label: 'Exports', count: exports?.length }
        ]}
      />

      <TabsContent value="images">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs text-ink-dim">Importez vos designs, puis lancez une analyse.</p>
          <Button size="sm" icon={<Upload className="h-4 w-4" />} onClick={() => void importImages()}>
            Importer des images
          </Button>
        </div>
        {images === null ? (
          <Spinner />
        ) : images.length === 0 ? (
          <EmptyState
            icon={<ImageIcon className="h-8 w-8" />}
            title="Aucune image"
            description="Importez une image de design (PNG, JPEG ou WebP) pour commencer."
            action={
              <Button icon={<Upload className="h-4 w-4" />} onClick={() => void importImages()}>
                Importer
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((image) => (
              <Card key={image.id} className="space-y-3 p-4">
                <button
                  onClick={() => setLightbox({ imageId: image.id, caption: image.fileName })}
                  className="block w-full overflow-hidden rounded-lg border border-line bg-panel-2"
                >
                  <img src={mediaUrl(image.id)} alt={image.fileName} className="h-44 w-full object-contain" />
                </button>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-medium text-ink">{image.fileName}</span>
                    <Badge tone={roleLabels[image.role]?.tone ?? 'neutral'}>
                      {roleLabels[image.role]?.label ?? image.role}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-ink-faint">
                    {image.width}×{image.height} · {formatBytes(image.sizeBytes)} · {formatDate(image.createdAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => setWizardImage(image)}
                    title="Lancer une analyse sur cette image"
                  >
                    Analyser
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<Trash2 className="h-3.5 w-3.5" />}
                    onClick={() => {
                      if (confirm(`Supprimer l’image « ${image.fileName} » ?`)) void removeImage(image)
                    }}
                  />
                </div>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="analyses">
        {analyses === null ? (
          <Spinner />
        ) : analyses.length === 0 ? (
          <EmptyState
            title="Aucune analyse"
            description="Lancez une analyse depuis l’onglet Images pour obtenir un Indice Félicité."
            action={
              <Button icon={<FolderPlus className="h-4 w-4" />} onClick={() => setTab('images')}>
                Aller aux images
              </Button>
            }
          />
        ) : (
          <ul className="space-y-2">
            {analyses.map((analysis) => (
              <li key={analysis.id}>
                <Card className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={analysis.status === 'completed' ? 'ok' : analysis.status === 'failed' ? 'danger' : 'accent'}>
                        {analysis.status === 'completed' ? 'Terminée' : analysis.status === 'failed' ? 'Échec' : 'En cours'}
                      </Badge>
                      <span className="truncate text-sm text-ink">
                        {analysis.productSummary ?? `Analyse ${analysis.id.slice(0, 8)}`}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-ink-faint">
                      {formatDateTime(analysis.createdAt)} · {analysis.model} · protocole {analysis.protocolVersion}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {analysis.felicityIndex !== null ? (
                      <div className="text-right">
                        <div className="text-lg font-semibold text-accent">{analysis.felicityIndex}</div>
                        <div className="text-[10px] uppercase tracking-wider text-ink-faint">Indice Félicité</div>
                      </div>
                    ) : null}
                    <div className="flex gap-2">
                      {analysis.status === 'completed' ? (
                        <Link to={`/projects/${projectId}/analyses/${analysis.id}`}>
                          <Button size="sm">Voir le rapport</Button>
                        </Link>
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        icon={<Trash2 className="h-3.5 w-3.5" />}
                        onClick={() => {
                          if (confirm('Supprimer cette analyse ?')) void deleteAnalysis(analysis.id)
                        }}
                      />
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>

      <TabsContent value="variants">
        {variants === null ? (
          <Spinner />
        ) : variants.length === 0 ? (
          <EmptyState
            title="Aucune variante de redesign"
            description="Générez un redesign depuis un rapport d’analyse."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {variants.map((variant) => (
              <Card key={variant.id} className="space-y-3 p-4">
                <button
                  onClick={() =>
                    variant.image
                      ? setLightbox({
                          imageId: variant.image.id,
                          caption: variant.promptText.slice(0, 400)
                        })
                      : undefined
                  }
                  className="block w-full overflow-hidden rounded-lg border border-line bg-panel-2"
                  disabled={!variant.image}
                >
                  {variant.image ? (
                    <img src={mediaUrl(variant.image.id)} alt="Variante" className="h-44 w-full object-contain" />
                  ) : (
                    <div className="flex h-44 items-center justify-center text-xs text-ink-faint">
                      Génération échouée : {variant.errorCode ?? 'erreur inconnue'}
                    </div>
                  )}
                </button>
                <div className="flex items-center justify-between gap-2">
                  <Badge tone={variant.mode === 'premium' ? 'info' : 'accent'}>
                    {variant.mode === 'premium' ? 'Premium' : 'Fidèle'}
                  </Badge>
                  <span className="truncate text-[11px] text-ink-faint">{variant.model}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<Eye className="h-3.5 w-3.5" />}
                    onClick={() => setLightbox({ imageId: variant.image?.id ?? '', caption: variant.promptText.slice(0, 400) })}
                    disabled={!variant.image}
                  >
                    Détail
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    icon={<Trash2 className="h-3.5 w-3.5" />}
                    onClick={() => {
                      if (confirm('Supprimer cette variante ?')) void deleteVariant(variant.id)
                    }}
                  />
                </div>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="experiments">
        <ExperimentsPanel
          projectId={projectId}
          variants={variants ?? []}
          onVariantsChanged={() => void load()}
        />
      </TabsContent>

      <TabsContent value="exports">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-xs text-ink-dim">
            Exportez vos rapports d’analyse (PDF pour partager, JSON pour conserver la donnée complète).
          </p>
          <Button
            size="sm"
            icon={<Download className="h-4 w-4" />}
            disabled={completedAnalyses.length === 0}
            onClick={() => void createExport(completedAnalyses[0]?.id, 'pdf')}
          >
            Exporter la dernière analyse
          </Button>
        </div>
        {exports === null ? (
          <Spinner />
        ) : exports.length === 0 ? (
          <EmptyState
            title="Aucun export"
            description={
              completedAnalyses.length === 0
                ? 'Terminez une analyse avant de la exporter.'
                : 'Créez votre premier export PDF ou JSON.'
            }
          />
        ) : (
          <ul className="space-y-2">
            {exports.map((exp) => (
              <li key={exp.id}>
                <Card className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge tone={exp.format === 'pdf' ? 'accent' : 'info'}>{exp.format.toUpperCase()}</Badge>
                      <span className="truncate text-sm text-ink">{exp.filePath}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-ink-faint">{formatDateTime(exp.createdAt)}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="outline" onClick={() => void call(window.api.exports.reveal(exp.filePath)).then(() => toast('success', 'Fichier ouvert.'))}>
                      Ouvrir
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      icon={<Trash2 className="h-3.5 w-3.5" />}
                      onClick={() => {
                        if (confirm('Supprimer cet export ?')) {
                          void call(window.api.exports.delete(exp.id)).then(() => void load())
                        }
                      }}
                    />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>

      <AnalysisWizard
        open={wizardImage !== null}
        onClose={() => setWizardImage(null)}
        projectId={projectId}
        image={wizardImage ?? { id: '' } as ImageDTO}
        onRun={(analysisId) => {
          setWizardImage(null)
          navigate(`/projects/${projectId}/analyses/${analysisId}`)
        }}
      />

      <Dialog open={renameOpen} onOpenChange={setRenameOpen} title="Renommer le projet">
        <Field label="Nom du projet" required>
          <Input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void saveRename()
            }}
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => setRenameOpen(false)}>
            Annuler
          </Button>
          <Button size="sm" onClick={() => void saveRename()}>
            Enregistrer
          </Button>
        </div>
      </Dialog>

      <Dialog open={lightbox !== null} onOpenChange={(open) => (!open ? setLightbox(null) : null)} title="Aperçu">
        {lightbox && lightbox.imageId ? (
          <div className="space-y-3">
            <img src={mediaUrl(lightbox.imageId)} alt="Aperçu" className="max-h-[60vh] w-full rounded-lg bg-panel-2 object-contain" />
            {lightbox.caption ? <p className="whitespace-pre-wrap text-xs text-ink-dim">{lightbox.caption}</p> : null}
          </div>
        ) : null}
      </Dialog>
    </div>
  )
}