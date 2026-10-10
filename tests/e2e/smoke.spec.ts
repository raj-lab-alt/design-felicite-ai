import { test, expect, _electron as electron } from 'playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function cleanupHome(home: string): void {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      rmSync(home, { recursive: true, force: true })
      return
    } catch {
      // Le process Electron / SQLite wasm relâche encore les fichiers :
      // réessayer avec un court délai avant d'abandonner.
      const end = Date.now() + 500
      while (Date.now() < end) {
        /* noop */
      }
    }
  }
}

test.describe('Application de bureau (smoke)', () => {
  test('démarre, ouvre la fenêtre principale et affiche l’accueil', async () => {
    const home = mkdtempSync(join(tmpdir(), 'design-felicite-e2e-'))
    try {
      const electronApp = await electron.launch({
        args: [join(__dirname, '../../out/main/index.js')],
        env: { ...process.env as Record<string, string>, DESIGN_FELICITE_HOME: home }
      })

      const window = await electronApp.firstWindow()
      await window.waitForLoadState('domcontentloaded')

      await expect(window).toHaveTitle('Design Félicité AI')
      // L'accueil liste les actions rapides : la barre latérale "Accueil" est visible.
      await expect(window.locator('body')).toContainText('Projets récents')

      await electronApp.close()
    } finally {
      cleanupHome(home)
    }
  })

  test('crée un projet depuis la bibliothèque et navigue vers sa page', async () => {
    const home = mkdtempSync(join(tmpdir(), 'design-felicite-e2e-'))
    try {
      const electronApp = await electron.launch({
        args: [join(__dirname, '../../out/main/index.js')],
        env: { ...process.env as Record<string, string>, DESIGN_FELICITE_HOME: home }
      })

      const window = await electronApp.firstWindow()
      await window.waitForLoadState('domcontentloaded')

      await window.getByRole('link', { name: 'Bibliothèque' }).click()
      await window.getByRole('button', { name: 'Nouveau projet' }).first().click()
      await window.getByRole('dialog').getByPlaceholder('Ex. : Bougies artisanales 2026').fill('Projet e2e')
      await window.getByRole('dialog').getByRole('button', { name: 'Créer' }).click()

      // Après création : la page projet s'affiche (et non un écran vide).
      await expect(window.locator('body')).toContainText('Projet e2e')
      await expect(window).toHaveURL(/\/projects\/proj_/)

      await electronApp.close()
    } finally {
      cleanupHome(home)
    }
  })

  test('les paramètres affichent le canal de mise à jour (état vu par le renderer)', async () => {
    const home = mkdtempSync(join(tmpdir(), 'design-felicite-e2e-'))
    try {
      const electronApp = await electron.launch({
        args: [join(__dirname, '../../out/main/index.js')],
        env: { ...process.env as Record<string, string>, DESIGN_FELICITE_HOME: home }
      })

      const window = await electronApp.firstWindow()
      await window.waitForLoadState('domcontentloaded')

      await window.getByRole('link', { name: 'Paramètres' }).click()
      // En développement (non empaqueté), le canal est désactivé : l'IPC
      // `app:check-update` doit répondre sans erreur et afficher l'état.
      await expect(window.getByTestId('update-status')).toContainText('Mises à jour désactivées')

      await electronApp.close()
    } finally {
      cleanupHome(home)
    }
  })
})