# SECURITY — Design Félicité AI

Modèle de menace, contrôles mis en place et directives pour signaler un problème.

## 1. Périmètre

Application de bureau locale (Windows, Electron 44). Elle manipule des designs commerciaux (fichiers image) et appelle l'API Google Gemini pour l'analyse et la génération d'images. Aucune donnée n'est envoyée ailleurs que vers Google Gemini (sur action explicite de l'utilisateur).

## 2. Données sensibles

| Donnée | Stockage | Exposition |
| --- | --- | --- |
| Clé API Gemini | Chiffrée `safeStorage` (DPAPI Windows). Fallback clair **explicite et affiché** si le chiffrement est indisponible. | Processus main uniquement. Jamais en base, jamais dans les logs, jamais envoyée au renderer. |
| Images & analyses | Local — `%APPDATA%\design-felicite-ai\` (data, media, logs, backups). | Accès local uniquement. |
| Consentement (reconnaissance visuelle IA) | Base SQLite, champ `privacyConsentGivenAt`. | Aucune analyse n'est possible sans lui. |

## 3. Architecture de sécurité

- **Renderer isolé** : `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`. Aucun accès Node depuis le renderer.
- **CSP stricte en production** (`index.html`) ; en développement seulement, un plugin (`devCspPlugin`) relâche la CSP pour le hot-reload — jamais activé dans les builds de production.
- **IPC en whitelist** : seuls les canaux déclarés dans `src/main/ipc/register.ts` sont enregistrés ; chaque payload est validé par un schéma zod avant traitement. Pas de `ipcMain.handle` générique/arbitraire.
- **Zéro module natif** : base SQLite en wasm (`node-sqlite3-wasm`) → surface d'attaque réduite et pas de compilation post-install.
- **Protocole `media:`** : schéma privilégié (`standard`, `secure`, `supportFetchAPI`, `stream`), handler qui ne sert que des images existantes en base (pas de lecture de chemin arbitraire).
- **Téléchargement Electron** : `.npmrc` du projet force mirror GitHub (voir `scripts/patch-electronrc.mjs`) ; dépendances verrouillées par versions exactes.

## 4. Maniement des fichiers

- Les originaux ne sont **jamais modifiés** : copies redimensionnées en mémoire (`nativeImage`) et stockées dans `media/`.
- L'import contrôle l'extension **et** les signatures d'en-têtes (PNG/JPEG/WebP — `src/main/utils/imageMeta.ts`) ; l'API Gemini reçoit uniquement ces formats reconnus.

## 5. Promesses / publicité

Le protocole interdit au modèle de promettre des résultats de vente ou de recourir à des mesures neurologiques pseudo-scientifiques ; les recommandations opérationnelles sélectionnées servent, elles, au redesign.

## 6. Vulnérabilités connues / limitations

- `safeStorage` peut échouer (clé DPAPI indisponible) ; dans ce cas un message explicite prévient que la clé est stockée en clair.
- L'exécutable de distribution n'est pas signé (pas de certificat) ; Windows peut afficher SmartScreen au premier lancement.

## 7. Signaler un problème

Signaler une vulnérabilité via l'issue tracker du projet (aucun canal public dédié pour l'instant). Ne pas publier de détails exploitables avant correction.