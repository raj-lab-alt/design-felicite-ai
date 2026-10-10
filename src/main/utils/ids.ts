import { createHash, randomUUID } from 'node:crypto'

export function newId(prefix?: string): string {
  const id = randomUUID()
  return prefix ? `${prefix}_${id}` : id
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function sha256Hex(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex')
}

export function toSqliteBool(value: boolean): number {
  return value ? 1 : 0
}

export function fromSqliteBool(value: unknown): boolean {
  return value === 1 || value === true
}
