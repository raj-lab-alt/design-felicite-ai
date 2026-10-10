import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

let logFilePath: string | null = null

export function configureLogger(filePath: string): void {
  logFilePath = filePath
  try {
    mkdirSync(dirname(filePath), { recursive: true })
  } catch {
    // ignore
  }
}

/** Masque toute chaîne ressemblant à une clé API ou à un secret. */
export function redactSecrets(input: string): string {
  return input
    .replace(/AIza[0-9A-Za-z\-_]{20,}/g, 'AIza***REDACTED***')
    .replace(/(api[-_]?key["'\s:=]+)[0-9A-Za-z\-_./+]{12,}/gi, '$1***REDACTED***')
    .replace(/(Bearer\s+)[0-9A-Za-z\-_./+]{12,}/gi, '$1***REDACTED***')
}

function format(level: LogLevel, message: string, meta?: unknown): string {
  const ts = new Date().toISOString()
  let line = `[${ts}] [${level.toUpperCase()}] ${message}`
  if (meta !== undefined) {
    try {
      line += ` ${redactSecrets(JSON.stringify(meta))}`
    } catch {
      line += ' [meta non sérialisable]'
    }
  }
  return redactSecrets(line)
}

function write(level: LogLevel, message: string, meta?: unknown): void {
  const line = format(level, message, meta)
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
  if (logFilePath) {
    try {
      appendFileSync(logFilePath, line + '\n', { encoding: 'utf8' })
    } catch {
      // ignore les erreurs d'écriture de log
    }
  }
}

export const logger = {
  debug: (message: string, meta?: unknown) => write('debug', message, meta),
  info: (message: string, meta?: unknown) => write('info', message, meta),
  warn: (message: string, meta?: unknown) => write('warn', message, meta),
  error: (message: string, meta?: unknown) => write('error', message, meta)
}
