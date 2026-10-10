import { describe, expect, it } from 'vitest'
import { maskApiKey } from '@main/gemini/keys'

describe('maskApiKey', () => {
  it('masque une clé complète (4 + 4)', () => {
    expect(maskApiKey('AIzaSyA1234567890abcdZxcv')).toBe('AIza••••Zxcv')
  })

  it('masque entièrement les clés très courtes', () => {
    expect(maskApiKey('abc')).toBe('••••••••')
    expect(maskApiKey('12345678')).toBe('••••••••')
  })

  it('ignore les espaces superflus', () => {
    expect(maskApiKey('  AIzaXyz9876543210abCD  ')).toBe('AIza••••abCD')
  })
})