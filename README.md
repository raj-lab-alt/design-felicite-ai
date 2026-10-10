# Design Félicité AI

Application de bureau professionnelle (Windows) d'analyse et d'optimisation des designs commerciaux : analyse visuelle multimodale via Google Gemini, scoring heuristique « Indice Félicité », génération d'images de redesign, persistance locale SQLite et exports PDF/JSON.

## Aperçu

- **Analyse** : un design (image) est soumis à Gemini avec un protocole strict (inclus en clair dans `resources/protocol/design-analysis/v1/system-prompt.md`). Le modèle produit un rapport structuré par dimension (visuel, hiérarchie, harmonie, adéquation cible, valeur perçue, émotion, message, crédibilité, adaptation support, lisibilité petit format), en distinguant ce qui est **visible**, **inféré** et **inconnu**.
- **Scoring** : chaque dimension reçoit une note 0-100 pondérée + niveaux de confiance, construisant un **Indice Félicité**. Un jeu d'heuristiques (marque-page brut, encarts concurrents, avatar au 3-points, fond très contrasté, asymétrie… — voir `src/main/services/ScoresService.ts`) vient contrebalancer les avis du modèle.
- **Redesign** : génération de variantes (mode *fidèle* ou *premium*) à partir des recommandations sélectionnées, avec préservation de l'identité produit (formes, proportions, cadrage), blocs de structures interdits (pas de logos/texte/chiffres inventés) et validation des dimensions de sortie.
- **Expériences** : suivi d'expériences (A/B…) par variante et métrique. L'application est honnête : elle n'émet **aucun verdict** sous 20 observations par variante (`MIN_SAMPLE`) et compare moyenne + écart-type des métriques.
- **Export** : rapport complet en PDF (généré côté main via `pdfmake`, polices embarquées) et en JSON structuré.

## Prérequis

- Node.js ≥ 22.12 (bundle portable recommandé sous Windows)
- Windows 10/11 (x64)

## Installation

```bash
npm install        # postinstall patche le .npmrc d'Electron pour le réseau
npm run dev        # lance l'application en mode développement
```

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Lancement en développement (hot reload) |
| `npm run build` | Build des bundles main/preload/renderer dans `out/` |
| `npm run typecheck` | `tsc --noEmit` pour les projets node et web |
| `npm run lint` | ESLint (flat config, `eslint.config.mjs`) |
| `npm run test` | Suite vitest (unitaire + intégration) |
| `npm run test:unit` | Tests unitaires seuls |
| `npm run test:integration` | Tests d'intégration (base SQLite réelle) |
| `npm run test:e2e` | Playwright (à configurer) |
| `npm run make-icon` | Génère `build/icon.png` et `build/icon.ico` sans dépendance |
| `npm run dist` | Build + installateur NSIS dans `release/` |
| `npm run dist:dir` | Build + exécutable non installé dans `release/win-unpacked` |
| `npm run dist:publish` | Build + installateur puis publication (nécessite un provider `publish`) |

## Structure

```
src/
  shared/            Contrats partagés (schémas zod, IPC, constantes, erreurs)
  main/
    index.ts         Bootstrap Electron (fenêtre, protocole media:, fichiers locaux)
    db/              SQLite wasm (migrations, DatabaseService)
    services/        Logique métier (projets, médias, analyse, redesign, expériences, exports, diagnostics, usage)
    gemini/          Clients et providers Gemini (vision, génération d'images)
    ipc/             Enregistrement des canaux IPC (whitelist + validation zod)
  preload/           Bridge exposé à `window.api`
  renderer/          UI React (pages, composants, store, kit UI)
resources/protocol/  Protocole d'analyse (prompt système versionné)
tests/               Vitest (unit + integration) et fixtures
build/               Ressources d'installation (icônes générées)
```

## Données locales

Les données résident dans `%APPDATA%\design-felicite-ai\` :

```
data/    base SQLite (projets, images, analyses, variantes, expériences, réglages)
media/   fichiers image originaux (jamais modifiés)
logs/    journaux applicatifs
backups/ sauvegardes de la base
```

## Sécurité des données

- Clé API Gemini chiffrée via `safeStorage` d'Electron (DPAPI sur Windows) ; jamais écrite dans la base ni les logs.
- Fenêtre avec `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false` ; seuls des canaux IPC déclarés et validés (`src/main/ipc/register.ts`) sont accessibles.
- Voir `SECURITY.md` pour les détails et le modèle de menace.

## Modèles par défaut

- Analyse : `gemini-2.5-flash`
- Génération d'images : `gemini-3.1-flash-image`

(Modifiables dans Paramètres.)

## Mises à jour automatiques

La vérification des mises à jour est intégrée (Paramètres → Mises à jour) via `electron-updater`, mais **désactivée tant qu'aucun dépôt n'est configuré** :

- En production, electron-builder génère `Resources/app-update.yml` dès qu'une section `publish` est présente dans `electron-builder.yml` (ex. GitHub Releases ou une URL générique).
- En test, la variable `DESIGN_FELICITE_UPDATE_URL` active un dépôt *generic*.
- Le canal reste inactif en développement (application non empaquetée) et sans le moindre effet de bord.

Un workflow GitHub Actions (`release.yml`) prépare la publication à chaque tag `v*`.

## Signature de code (Windows)

L'installateur n'est **pas signé** par défaut : Windows SmartScreen peut afficher un avertissement. Pour signer :

- **Certificat signé (OV/EV)** : définir les variables d'environnement `CSC_LINK` (`.pfx`/`.p12`) et `CSC_KEY_PASSWORD` avant `npm run dist`.
- **Azure Trusted Signing** : configurer `azureSignOptions` dans `electron-builder.yml`.

La signature protège aussi l'intégrité des mises à jour (vérification automatique côté `electron-updater`).

## Licence

UNLICENSED — usage privé. Voir `package.json`.