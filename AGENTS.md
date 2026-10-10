# AGENTS.md — Guide pour travailler sur « Design Félicité AI »

Application de bureau Windows (Electron 44 + React 19 + TypeScript) d'analyse visuelle
multimodale Gemini des designs commerciaux : scoring heuristique (« Indice Félicité »),
propositions de redesign, génération d'images, expériences A/B, exports PDF/JSON.

## Commandes utiles
- **Node portable** : le Node système peut être absent ; préfixer les commandes npm :
  `$env:Path = "$env:LOCALAPPDATA\opencode-toolchain\node;" + $env:Path`
  puis utiliser `& "$env:LOCALAPPDATA\opencode-toolchain\node\npm.cmd" run …`
- `npm run dev` — démarre l'app (dev). Crée/supprime des fichiers d'état : ne pas lancer sauf besoin.
- `npm run build` — build electron-vite dans `out/` (obligatoire avant l'e2e).
- `npm run typecheck` — tsc node + web (source de vérité, jamais de « skip »).
- `npm run lint` — ESLint (flat config `eslint.config.mjs`).
- `npm run test` — Vitest (unit + intégration, `tests/`).
- `npm run test:e2e` — Playwright (`tests/e2e/smoke.spec.ts`) ; exige `npm run build` d'abord.
- `npm run dist` / `dist:dir` — empaquetage electron-builder (format `release/`), gros/timeout long.

## Contraintes non négociables
- **Versions verrouillées** : electron `44.7.0`, vite `7.3.7`, react `19.x`, zod `4.6.5`,
  TS `5.9.3` — ne JAMAIS monter TypeScript en 7.x. Ne pas ajouter un autre moteur de
  template/state sans accord explicite. stack : electron-vite, React 19, zustand, Tailwind v4.
- **Security first** : `contextIsolation`, `sandbox`, `nodeIntegration` off. Les clés API ne
  sortent JAMAIS du process principal, ne vont JAMAIS dans SQLite, logs ou réponses IPC.
  IPC = liste blanche stricte (`src/shared/ipc.ts` + `register.ts` + `preload/index.ts` doivent
  être modifiés ensemble). Toute entrée est validée par zod (`src/shared/schemas.ts`).
- **Sécurité des secrets** : `src/main/services/SecureStorageService.ts` chiffre chaque clé via
  `safeStorage` (DPAPI). Plusieurs clés stockées en liste : `getApiKeys()`, index 0 = principale.
  Le renderer ne voit que des aperçus masqués (`maskApiKey`). En cas de chiffrement indisponible,
  dialog explicite avant stockage en clair.
- **Data privée locale** : `%APPDATA%\design-felicite-ai\{data,media,logs,backups}` ;
  SQLite wasm (`node-sqlite3-wasm`, pas de module natif) ; `DESIGN_FELICITE_HOME` redirige userData
  (utilisé par les tests e2e avec un dossier temporaire).
- **Electron** : `session.defaultSession.*` uniquement après `app.whenReady()` (crash sinon),
  via `hardenSession()`. Protocole media `media://image/<id>`.
- **React 19** : tout `.tsx` utilisant `React.JSX.Element`/`React.ReactNode` doit importer la
  valeur `React` (types) — jamais le dernier type TS « page » d'erreurs silencieuses.
- **Renderer** : `call<T>(window.api.x.y(...))` (voir `src/renderer/src/lib/api.ts`) ; types métier
  depuis `@shared/schemas`, DTO depuis `@shared/ipc` ; UI par petits composants `src/components/ui`.

## Bascule clé/modèle (Gemini)
- `src/main/gemini/failover.ts` : `runWithFailover` pur et unit-testé — clé épuisée/refusée
  (ERR_API_UNAUTHORIZED, ERR_QUOTA_EXCEEDED, ERR_RATE_LIMITED) → clé suivante ; modèle indisponible
  / panne / timeout / réponse vide (ERR_MODEL_UNAVAILABLE, ERR_NETWORK, ERR_TIMEOUT,
  ERR_RESPONSE_EMPTY) → modèle suivant. Erreur définitive → remontée immédiate. Dernière erreur
  enrichie de `details.failoverAttempts`.
- `GeminiService.completeVision` / `generateImage` orchestrent ; les réponses exposent le modèle
  réellement utilisé (`model`, `apiKeyIndex`, `failoverAttempts`). Modèles listés dans les
  paramètres : `analysisModels` / `imageModels` (premier = principal).
- Client mis en cache par clé (`client.ts`) ; `resetGeminiClients()` à chaque changement de clés.

## Tests
- Unit : `tests/unit/*` ; intégration : `tests/integration/db.test.ts` (SQLite in-memory).
- e2e : `tests/e2e/smoke.spec.ts` (lance le build avec userData temporaire via
  `DESIGN_FELICITE_HOME`). Toujours relancer typecheck + lint + test après modification du code.

## Publication / mises à jour (GitHub Releases)
- Feed `electron-updater` = `provider: github` (`raj-lab-alt/design-felicite-ai`) dans
  `electron-builder.yml` → embarque `app-update.yml` et génère `latest.yml`.
- Nouvelle version : `npm version patch` (commit + tag `vX.Y.Z`) puis `git push --follow-tags` ;
  le workflow `release.yml` (`npm run dist:ci` + upload) publie sur la Release GitHub.
- L'updater n'installe qu'une version strictement supérieure → **toujours** bumper `version`.
- Itération locale sans réinstallation : `npm run dev` (le canal est inactif non empaqueté).
- Dépôt GitHub **public** requis (pas de jeton embarqué).

## Docs
Voir `README.md` (usage, développeur) et `SECURITY.md` (menaces, secrets, canal de mise à jour).