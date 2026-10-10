import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Download, KeyRound, Plus, RefreshCcw, Save, ShieldCheck, Trash2, Wand2, X } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Dialog,
  EmptyState,
  Field,
  Input,
  Select,
  Spinner,
  Switch,
  Textarea
} from '../components/ui'
import { call } from '../lib/api'
import { formatDateTime } from '../lib/format'
import { useAppStore } from '../store/useAppStore'
import { SUGGESTED_ANALYSIS_MODELS, SUGGESTED_IMAGE_MODELS, WEIGHT_PROFILES } from '@shared/constants'
import type { AppSettings, AppSettingsPatch, BrandProfile, BrandProfileInput } from '@shared/schemas'
import type { SecretStatusDTO, UpdateStatus } from '@shared/ipc'

const emptyProfile: BrandProfileInput = {
  name: '',
  description: '',
  sector: '',
  market: '',
  audience: '',
  positioning: '',
  visualTone: '',
  recommendedPalette: [],
  colorsToAvoid: [],
  qualityType: '',
  priceRange: '',
  manufacturingConstraints: '',
  brandValues: [],
  allowedPromises: [],
  forbiddenPromises: [],
  visualReferences: [],
  photoStyle: '',
  competitivePositioning: ''
}

/**
 * Éditeur d'une liste ordonnée de modèles : le premier est le principal,
 * les suivants servent de secours (bascule automatique en cas de panne).
 */
function ModelListEditor({
  label,
  hint,
  models,
  suggested,
  onChange
}: {
  label: string
  hint?: string
  models: string[]
  suggested: readonly string[]
  onChange: (models: string[]) => void
}): React.JSX.Element {
  const [value, setValue] = useState('')

  const addModel = (raw: string): void => {
    const model = raw.trim()
    if (!model) return
    if (!models.some((m) => m === model)) {
      onChange([...models, model])
    }
    setValue('')
  }

  const moveModel = (index: number, direction: -1 | 1): void => {
    const target = index + direction
    if (target < 0 || target >= models.length) return
    const next = models.slice()
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  const removeModel = (index: number): void => {
    onChange(models.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2">
      <Field label={label} hint={hint}>
        <div className="flex gap-2">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addModel(value)
              }
            }}
            placeholder="ex. gemini-2.5-pro"
          />
          <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => addModel(value)}>
            Ajouter
          </Button>
        </div>
      </Field>
      {models.length > 0 ? (
        <ol className="space-y-1">
          {models.map((model, index) => (
            <li
              key={index}
              className="flex items-center gap-2 rounded-lg border border-line bg-panel-2 px-3 py-1.5"
            >
              <span className="text-xs text-ink-dim">{index + 1}.</span>
              {index === 0 ? <Badge tone="ok">principal</Badge> : null}
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{model}</span>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="ghost" size="sm" aria-label="Monter dans la priorité" disabled={index === 0} onClick={() => moveModel(index, -1)}>
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" aria-label="Descendre dans la priorité" disabled={index === models.length - 1} onClick={() => moveModel(index, 1)}>
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" aria-label="Retirer ce modèle" onClick={() => removeModel(index)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        {suggested
          .filter((m) => !models.some((x) => x === m))
          .map((m) => (
            <button
              key={m}
              onClick={() => addModel(m)}
              className="rounded-full border border-line px-2 py-0.5 text-xs text-ink-dim transition-colors hover:border-accent/50 hover:text-accent"
            >
              + {m}
            </button>
          ))}
      </div>
    </div>
  )
}

function updateStatusMessage(status: UpdateStatus): string {
  switch (status.state) {
    case 'disabled':
      return `${status.message} Aucun dépôt de publication n'est configuré.`
    case 'idle':
      return `Version installée : ${status.currentVersion}.`
    case 'checking':
      return status.message
    case 'available':
      return `Une nouvelle version (v${status.version}) est disponible.`
    case 'up-to-date':
    case 'downloading':
      return status.state === 'downloading' ? `Téléchargement… ${status.percent} %` : status.message
    case 'downloaded':
      return `La version v${status.version} est téléchargée, prête à être installée.`
    case 'error':
      return status.message
  }
}

export function SettingsPage(): React.JSX.Element {
  const settings = useAppStore((s) => s.settings)
  const secrets = useAppStore((s) => s.secrets)
  const info = useAppStore((s) => s.info)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const refreshSecrets = useAppStore((s) => s.refreshSecrets)
  const toast = useAppStore((s) => s.toast)

  const [apiKey, setApiKey] = useState('')
  const [consent, setConsent] = useState(false)
  const [draft, setDraft] = useState<AppSettings | null>(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    ok: boolean
    latencyMs: number
    message: string
    usedFallback?: boolean
    apiKeyIndex?: number
  } | null>(null)
  const [saving, setSaving] = useState(false)

  const [profiles, setProfiles] = useState<BrandProfile[] | null>(null)
  const [profileEditor, setProfileEditor] = useState<{ mode: 'create' | 'edit'; id?: string } | null>(null)
  const [profileForm, setProfileForm] = useState<BrandProfileInput>(emptyProfile)

  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null)
  const [checkingUpdate, setCheckingUpdate] = useState(false)

  const loadProfiles = useCallback(async () => {
    try {
      setProfiles(await call(window.api.profiles.list()))
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Chargement impossible.')
    }
  }, [toast])

  useEffect(() => {
    if (settings) setDraft(settings)
    setConsent(!!settings?.privacyConsentGivenAt)
    void loadProfiles()
  }, [settings, loadProfiles])

  useEffect(
    () => window.api.events.onUpdateStatus((status) => setUpdateStatus(status)),
    []
  )

  useEffect(() => {
    void call(window.api.app.updateStatus())
      .then(setUpdateStatus)
      .catch(() => undefined)
  }, [])

  if (!settings || !draft || !secrets) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    )
  }

  const sec: SecretStatusDTO = secrets
  const patch = <K extends keyof AppSettingsPatch>(key: K, value: AppSettingsPatch[K]): void => {
    setDraft((d) => (d ? { ...d, [key]: value } : d))
  }

  const saveSettings = async (): Promise<void> => {
    if (!draft) return
    setSaving(true)
    try {
      await updateSettings(draft)
      toast('success', 'Paramètres enregistrés.')
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Enregistrement impossible.')
    } finally {
      setSaving(false)
    }
  }

  const saveApiKey = async (): Promise<void> => {
    try {
      await call(window.api.secrets.setApiKey(apiKey))
      setApiKey('')
      await refreshSecrets()
      toast('success', 'Clé API ajoutée (chiffrée).')
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Enregistrement impossible.')
    }
  }

  const removeApiKey = async (index: number): Promise<void> => {
    try {
      await call(window.api.secrets.removeApiKey(index))
      await refreshSecrets()
      toast('success', 'Clé API retirée.')
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Suppression impossible.')
    }
  }

  const prioritizeApiKey = async (index: number): Promise<void> => {
    try {
      await call(window.api.secrets.prioritizeApiKey(index))
      await refreshSecrets()
      toast('success', 'Clé principale modifiée.')
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Modification impossible.')
    }
  }

  const testConnection = async (): Promise<void> => {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await call(window.api.secrets.testConnection())
      setTestResult({
        ok: result.ok,
        latencyMs: result.latencyMs,
        message: result.message,
        usedFallback: result.usedFallback,
        apiKeyIndex: result.apiKeyIndex
      })
    } catch (error) {
      setTestResult({ ok: false, latencyMs: 0, message: error instanceof Error ? error.message : 'Test impossible.' })
    } finally {
      setTesting(false)
      await refreshSecrets()
    }
  }

  const checkForUpdates = async (): Promise<void> => {
    setCheckingUpdate(true)
    try {
      await call(window.api.app.checkUpdate())
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Vérification des mises à jour impossible.')
    } finally {
      setCheckingUpdate(false)
    }
  }

  const installUpdate = async (): Promise<void> => {
    try {
      await call(window.api.app.installUpdate())
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Installation impossible.')
    }
  }

  const saveConsent = async (): Promise<void> => {
    try {
      await updateSettings({ privacyConsentGivenAt: consent ? settings.privacyConsentGivenAt ?? new Date().toISOString() : null })
      toast('success', consent ? 'Consentement enregistré.' : 'Consentement retiré : aucune analyse ne sera possible.')
      setConsent(consent)
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Enregistrement impossible.')
    }
  }

  const openCreateProfile = (): void => {
    setProfileForm(emptyProfile)
    setProfileEditor({ mode: 'create' })
  }

  const openEditProfile = (profile: BrandProfile): void => {
    const { id, createdAt, updatedAt, ...rest } = profile
    void createdAt
    void updatedAt
    setProfileForm({ ...rest })
    setProfileEditor({ mode: 'edit', id })
  }

  const saveProfile = async (): Promise<void> => {
    if (!profileEditor || !profileForm.name.trim()) return
    try {
      if (profileEditor.mode === 'create') {
        await call(window.api.profiles.create(profileForm))
      } else if (profileEditor.id) {
        await call(window.api.profiles.update(profileEditor.id, profileForm))
      }
      setProfileEditor(null)
      toast('success', 'Profil de marque enregistré.')
      void loadProfiles()
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Enregistrement impossible.')
    }
  }

  const deleteProfile = async (id: string): Promise<void> => {
    if (!confirm('Supprimer ce profil de marque ?')) return
    try {
      await call(window.api.profiles.delete(id))
      toast('success', 'Profil supprimé.')
      void loadProfiles()
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Suppression impossible.')
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-semibold text-ink">Paramètres</h1>
        <p className="text-sm text-ink-dim">Configuration, modèles IA, consentement et profils de marque.</p>
      </div>

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          icon={<Save className="h-4 w-4" />}
          loading={saving}
          onClick={() => void saveSettings()}
        >
          Enregistrer les paramètres
        </Button>
      </div>

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-accent" /> Clés API Gemini
            </span>
          }
          subtitle={
            sec.configured
              ? `${sec.keyCount} clé${sec.keyCount > 1 ? 's' : ''} configurée${sec.keyCount > 1 ? 's' : ''} · stockage ${sec.storageMode}${sec.lastTestAt ? ` · dernier test : ${formatDateTime(sec.lastTestAt)} (${sec.lastTestOk === null ? '—' : sec.lastTestOk ? 'OK' : 'échec'})` : ''}`
              : 'Aucune clé enregistrée : les analyses sont indisponibles.'
          }
        />
        <div className="space-y-3">
          <Field
            label="Nouvelle clé API"
            hint="plusieurs clés possibles : En cas d’épuisement (quota) ou de refus, l’application bascule automatiquement sur la suivante"
          >
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Collez votre clé API Gemini"
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" icon={<Save className="h-4 w-4" />} onClick={() => void saveApiKey()}>
              Ajouter la clé
            </Button>
            <Button size="sm" variant="outline" icon={<RefreshCcw className="h-4 w-4" />} loading={testing} onClick={() => void testConnection()}>
              Tester la connexion
            </Button>
            {sec.configured ? (
              <Button
                size="sm"
                variant="danger"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={() => {
                  if (confirm('Supprimer toutes les clés API enregistrées ?')) void call(window.api.secrets.deleteApiKey()).then(refreshSecrets)
                }}
              >
                Tout supprimer
              </Button>
            ) : null}
          </div>
          {sec.keyCount > 0 ? (
            <ol className="space-y-1">
              {sec.maskedKeys.map((masked, index) => (
                <li key={index} className="flex items-center gap-2 rounded-lg border border-line bg-panel-2 px-3 py-1.5">
                  <span className="text-xs text-ink-dim">{index + 1}.</span>
                  {index === 0 ? <Badge tone="ok">principale</Badge> : null}
                  <code className="min-w-0 flex-1 truncate font-mono text-sm text-ink">{masked}</code>
                  <div className="flex shrink-0 items-center gap-1">
                    {index !== 0 ? (
                      <Button size="sm" variant="ghost" onClick={() => void prioritizeApiKey(index)}>
                        Définir principale
                      </Button>
                    ) : null}
                    <Button size="sm" variant="ghost" icon={<X className="h-4 w-4" />} aria-label="Retirer cette clé" onClick={() => void removeApiKey(index)} />
                  </div>
                </li>
              ))}
            </ol>
          ) : null}
          {testResult ? (
            <Badge tone={testResult.ok ? 'ok' : 'danger'}>
              {testResult.ok
                ? `Connexion OK (${testResult.latencyMs} ms${testResult.usedFallback ? ` · bascule utilisée (clé ${(testResult.apiKeyIndex ?? 0) + 1})` : ''})`
                : testResult.message}
            </Badge>
          ) : null}
          {sec.storageMode === 'unavailable' ? (
            <p className="text-xs text-warn">
              Le chiffrement natif est indisponible sur cette machine : les clés seront stockées en clair dans un fichier local avec
              permissions restreintes. Acceptez le consentement pour confirmer.
            </p>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-accent" /> Confidentialité & consentement
            </span>
          }
          subtitle="Vos images ne sont jamais envoyées à Gemini sans votre accord explicite."
        />
        <div className="space-y-3">
          <label className="flex items-start gap-3 rounded-lg border border-line bg-panel-2 p-3">
            <Switch checked={consent} onCheckedChange={(checked) => setConsent(checked)} label="Consentement" />
            <span className="text-xs text-ink-dim">
              J’accepte que mon image de design soit envoyée vers l’API Gemini (modèle d’analyse visuel) lorsque je lance une
              analyse ou un redesign, afin de produire un diagnostic visuel. Je comprends qu’aucun résultat n’est une promesse de
              vente ni une mesure psychologique, et que je reste maître des données (suppression locale possible à tout moment).
            </span>
          </label>
          <Button size="sm" variant="outline" onClick={() => void saveConsent()}>
            {consent ? 'Consentement accepté' : 'Accepter le consentement'}
          </Button>
          {!consent ? <p className="text-xs text-warn">Sans consentement, les boutons d’analyse sont désactivés.</p> : null}
        </div>
      </Card>

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-accent" /> Modèles IA & génération
            </span>
          }
          subtitle="Vous pouvez choisir librement tout modèle Gemini compatible."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ModelListEditor
            label="Modèles d’analyse (vision + texte)"
            hint="le premier est le principal ; en cas de panne ou de non-réponse, l’application bascule sur le suivant"
            models={draft.analysisModels}
            suggested={SUGGESTED_ANALYSIS_MODELS}
            onChange={(models) => patch('analysisModels', models)}
          />
          <ModelListEditor
            label="Modèles de génération d’images"
            hint="même mécanique de bascule automatique en cas de panne"
            models={draft.imageModels}
            suggested={SUGGESTED_IMAGE_MODELS}
            onChange={(models) => patch('imageModels', models)}
          />
          <Field label="Génération d’images">
            <div className="flex items-center gap-2">
              <Switch checked={draft.imageGenerationEnabled} onCheckedChange={(checked) => patch('imageGenerationEnabled', checked)} label="Activer la génération" />
              <span className="text-xs text-ink-dim">{draft.imageGenerationEnabled ? 'Activée' : 'Désactivée (conseillé pour commencer)'}</span>
            </div>
          </Field>
          <Field label="Présélection qualité">
            <Select
              options={[
                { value: 'economy', label: 'Économique (rapide)' },
                { value: 'balanced', label: 'Équilibré' },
                { value: 'quality', label: 'Qualité maximale' }
              ]}
              value={draft.qualityPreset}
              onValueChange={(value) => patch('qualityPreset', value as AppSettings['qualityPreset'])}
            />
          </Field>
          <Field label="Taille max. d’envoi (px / côté)" hint="les images sont redimensionnées avant envoi">
            <Input
              type="number"
              value={String(draft.maxUploadSide)}
              onChange={(e) => patch('maxUploadSide', Number(e.target.value) || 1600)}
            />
          </Field>
          <Field label="Profil de pondération par défaut">
            <Select
              options={Object.entries(WEIGHT_PROFILES).map(([id, p]) => ({ value: id, label: p.label }))}
              value={draft.defaultWeightProfile}
              onValueChange={(value) => patch('defaultWeightProfile', value)}
            />
          </Field>
          <Field label="Prix analyse — entrée ($ / M token)" hint="pour l’estimation locale">
            <Input type="number" step="any" value={String(draft.analysisInputPricePerMTok)} onChange={(e) => patch('analysisInputPricePerMTok', Number(e.target.value) || 0)} />
          </Field>
          <Field label="Prix analyse — sortie ($ / M token)">
            <Input type="number" step="any" value={String(draft.analysisOutputPricePerMTok)} onChange={(e) => patch('analysisOutputPricePerMTok', Number(e.target.value) || 0)} />
          </Field>
          <Field label="Coût par image générée ($)">
            <Input type="number" step="any" value={String(draft.imagePricePerImage)} onChange={(e) => patch('imagePricePerImage', Number(e.target.value) || 0)} />
          </Field>
          <Field label="Langue de l’interface">
            <Select
              options={[
                { value: 'fr', label: 'Français' },
                { value: 'en', label: 'English' }
              ]}
              value={draft.language}
              onValueChange={(value) => patch('language', value as AppSettings['language'])}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Profils de marque"
          subtitle="Utilisés par l’analyse et le redesign pour respecter votre charte (promesses autorisées, palette, ton)."
          actions={
            <Button size="sm" variant="outline" icon={<Plus className="h-4 w-4" />} onClick={openCreateProfile}>
              Nouveau profil
            </Button>
          }
        />
        {profiles === null ? (
          <Spinner />
        ) : profiles.length === 0 ? (
          <EmptyState title="Aucun profil de marque" description="Ajoutez un profil pour guider l’analyse avec vos codes." />
        ) : (
          <ul className="space-y-2">
            {profiles.map((profile) => (
              <li key={profile.id}>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-panel-2 p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{profile.name}</p>
                    <p className="truncate text-xs text-ink-dim">
                      {profile.sector || 'Secteur non précisé'} · {profile.qualityType || 'qualité non précisée'}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEditProfile(profile)}>
                      Modifier
                    </Button>
                    <Button size="sm" variant="danger" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => void deleteProfile(profile.id)} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="À propos" subtitle="Données de l’application" />
        <div className="grid grid-cols-2 gap-2 text-xs text-ink-dim sm:grid-cols-3">
          <p><strong className="text-ink">Version :</strong> {info?.appVersion ?? '—'}</p>
          <p><strong className="text-ink">Electron :</strong> {info?.electron ?? '—'}</p>
          <p><strong className="text-ink">Node :</strong> {info?.node ?? '—'}</p>
          <p><strong className="text-ink">Dossier données :</strong> {info?.userDataPath ?? '—'}</p>
          <p><strong className="text-ink">Base :</strong> {info?.dbPath ?? '—'}</p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Mises à jour" subtitle="Canal de mise à jour automatique de l’application." />
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              icon={<RefreshCcw className="h-4 w-4" />}
              disabled={checkingUpdate || updateStatus?.state === 'downloading'}
              onClick={() => void checkForUpdates()}
            >
              {checkingUpdate ? 'Vérification…' : 'Vérifier les mises à jour'}
            </Button>
            {updateStatus?.state === 'downloaded' ? (
              <Button icon={<Download className="h-4 w-4" />} onClick={() => void installUpdate()}>
                Installer et redémarrer (v{updateStatus.version})
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-ink-dim" data-testid="update-status">
            {updateStatus ? updateStatusMessage(updateStatus) : 'Statut inconnu.'}
          </p>
        </div>
      </Card>

      <Dialog
        open={profileEditor !== null}
        onOpenChange={(open) => (open ? null : setProfileEditor(null))}
        title={profileEditor?.mode === 'create' ? 'Nouveau profil de marque' : 'Modifier le profil'}
        description="Informations optionnelles mais précieuses pour respecter votre charte."
        width="max-w-2xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setProfileEditor(null)}>
              Annuler
            </Button>
            <Button disabled={!profileForm.name.trim()} onClick={() => void saveProfile()}>
              Enregistrer
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nom" required className="sm:col-span-2">
            <Input value={profileForm.name} onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="Description">
            <Textarea value={profileForm.description ?? ''} onChange={(e) => setProfileForm((f) => ({ ...f, description: e.target.value }))} />
          </Field>
          <Field label="Secteur">
            <Input value={profileForm.sector ?? ''} onChange={(e) => setProfileForm((f) => ({ ...f, sector: e.target.value }))} />
          </Field>
          <Field label="Marché / pays">
            <Input value={profileForm.market ?? ''} onChange={(e) => setProfileForm((f) => ({ ...f, market: e.target.value }))} />
          </Field>
          <Field label="Audience">
            <Input value={profileForm.audience ?? ''} onChange={(e) => setProfileForm((f) => ({ ...f, audience: e.target.value }))} />
          </Field>
          <Field label="Positionnement" className="sm:col-span-2">
            <Textarea value={profileForm.positioning ?? ''} onChange={(e) => setProfileForm((f) => ({ ...f, positioning: e.target.value }))} />
          </Field>
          <Field label="Ton visuel">
            <Input value={profileForm.visualTone ?? ''} onChange={(e) => setProfileForm((f) => ({ ...f, visualTone: e.target.value }))} />
          </Field>
          <Field label="Palette recommandée" hint="séparée par des virgules">
            <Input value={(profileForm.recommendedPalette ?? []).join(', ')} onChange={(e) => setProfileForm((f) => ({ ...f, recommendedPalette: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) }))} />
          </Field>
          <Field label="Couleurs à éviter">
            <Input value={(profileForm.colorsToAvoid ?? []).join(', ')} onChange={(e) => setProfileForm((f) => ({ ...f, colorsToAvoid: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) }))} />
          </Field>
          <Field label="Type de qualité">
            <Input value={profileForm.qualityType ?? ''} onChange={(e) => setProfileForm((f) => ({ ...f, qualityType: e.target.value }))} />
          </Field>
          <Field label="Fourchette de prix">
            <Input value={profileForm.priceRange ?? ''} onChange={(e) => setProfileForm((f) => ({ ...f, priceRange: e.target.value }))} />
          </Field>
          <Field label="Contraintes de fabrication" className="sm:col-span-2">
            <Textarea value={profileForm.manufacturingConstraints ?? ''} onChange={(e) => setProfileForm((f) => ({ ...f, manufacturingConstraints: e.target.value }))} />
          </Field>
          <Field label="Valeurs de marque">
            <Input value={(profileForm.brandValues ?? []).join(', ')} onChange={(e) => setProfileForm((f) => ({ ...f, brandValues: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) }))} />
          </Field>
          <Field label="Promesses autorisées">
            <Input value={(profileForm.allowedPromises ?? []).join(', ')} onChange={(e) => setProfileForm((f) => ({ ...f, allowedPromises: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) }))} />
          </Field>
          <Field label="Promesses interdites">
            <Input value={(profileForm.forbiddenPromises ?? []).join(', ')} onChange={(e) => setProfileForm((f) => ({ ...f, forbiddenPromises: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) }))} />
          </Field>
          <Field label="Références visuelles">
            <Input value={(profileForm.visualReferences ?? []).join(', ')} onChange={(e) => setProfileForm((f) => ({ ...f, visualReferences: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) }))} />
          </Field>
          <Field label="Style photo">
            <Input value={profileForm.photoStyle ?? ''} onChange={(e) => setProfileForm((f) => ({ ...f, photoStyle: e.target.value }))} />
          </Field>
          <Field label="Positionnement concurrentiel" className="sm:col-span-2">
            <Textarea value={profileForm.competitivePositioning ?? ''} onChange={(e) => setProfileForm((f) => ({ ...f, competitivePositioning: e.target.value }))} />
          </Field>
        </div>
      </Dialog>
    </div>
  )
}