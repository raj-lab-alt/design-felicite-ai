import { test, expect, _electron as electron } from 'playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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
      rmSync(home, { recursive: true, force: true })
    }
  })
})