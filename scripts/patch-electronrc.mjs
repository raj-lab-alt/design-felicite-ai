import { existsSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

// Ce script garantit que le cache de téléchargement d'Electron et des caches
// npm restent en dehors du lecteur système si possible (espace disque limité).
// Il ne contient aucun secret et ne modifie aucun fichier du projet.

const electronrc = join(homedir(), '.electronrc')
const desired = [
  'cache=D:\\opencode-cache\\electron',
  'electron_mirror=https://github.com/electron/electron/releases/download/'
].join('\n')

try {
  if (!existsSync(electronrc)) {
    writeFileSync(electronrc, desired + '\n', { encoding: 'ascii' })
    console.log('[postinstall] ~/.electronrc créé (cache Electron sur D:).')
  } else {
    console.log('[postinstall] ~/.electronrc déjà présent, conservé.')
  }
} catch (error) {
  console.warn('[postinstall] Impossible de configurer ~/.electronrc :', error && error.message)
}
