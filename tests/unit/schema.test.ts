import { test, expect } from 'vitest'
import { modelReportJsonSchema } from '../../src/shared/schemas'

function asRecord(value: unknown): Record<string, unknown> {
  return (value ?? {}) as Record<string, unknown>
}

/**
 * Mots-clés interdits dans le schéma envoyé à Gemini : non supportés, ou
 * contraintes qui font dépasser la limite « schema produces a constraint that
 * has too many states for serving » (400).
 */
const BANNED_KEYS = [
  '$schema',
  '$ref',
  '$defs',
  'additionalProperties',
  'default',
  'const',
  'oneOf',
  'allOf',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'minItems',
  'maxItems',
  'uniqueItems',
  'minLength',
  'maxLength',
  'pattern',
  'format',
  'minProperties',
  'maxProperties'
]

test('le schéma Gemini est simplifié : aucun mot-clé non supporté ni type null', () => {
  const schema = modelReportJsonSchema()
  const banned = new Set(BANNED_KEYS)
  const found = new Set<string>()
  let nullTypes = 0

  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    if (!node || typeof node !== 'object') return
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (banned.has(key)) found.add(key)
      if (key === 'type' && value === 'null') nullTypes += 1
      walk(value)
    }
  }
  walk(schema)

  expect([...found]).toEqual([])
  expect(nullTypes).toBe(0)
})

test('les bornes zod (0..100) ne sont pas transmises à Gemini', () => {
  const schema = modelReportJsonSchema()
  const scores = asRecord(asRecord(schema.properties).scores)
  const value = asRecord(asRecord(asRecord(scores.items).properties).value)
  expect(value.type).toBe('number')
  expect(value.nullable).toBe(true)
  expect(value.minimum).toBeUndefined()
  expect(value.maximum).toBeUndefined()
})
