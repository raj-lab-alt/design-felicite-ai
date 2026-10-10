import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { createHash } from 'node:crypto'
import { PROTOCOL_VERSION } from '@shared/constants'

export interface LoadedProtocol {
  version: string
  text: string
  hash: string
}

function protocolBasePath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'protocol', 'design-analysis')
  }
  return join(app.getAppPath(), 'resources', 'protocol', 'design-analysis')
}

let cached: LoadedProtocol | null = null

export function loadProtocol(): LoadedProtocol {
  if (cached) return cached
  const versionSegment = PROTOCOL_VERSION.split('/')[1] ?? 'v1'
  const filePath = join(protocolBasePath(), versionSegment, 'system-prompt.md')
  const text = readFileSync(filePath, 'utf8')
  const hash = createHash('sha256').update(text).digest('hex')
  cached = { version: PROTOCOL_VERSION, text, hash }
  return cached
}

export function protocolHash(): string {
  return loadProtocol().hash
}
