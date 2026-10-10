import { describe, expect, it } from 'vitest'
import { AppError } from '@shared/errors'
import { runWithFailover } from '@main/gemini/failover'

async function fail(code: string): Promise<never> {
  throw new AppError(code as never)
}

describe('runWithFailover', () => {
  it('réussit directement sur la clé et le modèle principal', async () => {
    const calls: string[] = []
    const outcome = await runWithFailover({
      keysLen: 2,
      models: ['gemini-a', 'gemini-b'],
      startKeyIndex: 0,
      attempt: async (keyIndex, model) => {
        calls.push(`${keyIndex}:${model}`)
        return 'ok'
      }
    })
    expect(outcome.result).toBe('ok')
    expect(outcome.keyIndex).toBe(0)
    expect(outcome.model).toBe('gemini-a')
    expect(outcome.attempts).toBe(1)
    expect(outcome.usedFallback).toBe(false)
    expect(calls).toEqual(['0:gemini-a'])
  })

  it('bascule sur la clé suivante quand la clé est épuisée (quota)', async () => {
    const calls: string[] = []
    const outcome = await runWithFailover({
      keysLen: 2,
      models: ['gemini-a'],
      startKeyIndex: 0,
      attempt: async (keyIndex, model) => {
        calls.push(`${keyIndex}:${model}`)
        if (keyIndex === 0) await fail('ERR_QUOTA_EXCEEDED')
        return 'ok'
      }
    })
    expect(outcome.keyIndex).toBe(1)
    expect(outcome.attempts).toBe(2)
    expect(outcome.usedFallback).toBe(true)
    expect(calls).toEqual(['0:gemini-a', '1:gemini-a'])
  })

  it('bascule sur un autre modèle quand le modèle est indisponible', async () => {
    const calls: string[] = []
    const outcome = await runWithFailover({
      keysLen: 1,
      models: ['gemini-a', 'gemini-b', 'gemini-c'],
      startKeyIndex: 0,
      attempt: async (keyIndex, model) => {
        calls.push(`${keyIndex}:${model}`)
        if (model === 'gemini-a' || model === 'gemini-b') await fail('ERR_MODEL_UNAVAILABLE')
        return 'ok'
      }
    })
    expect(outcome.model).toBe('gemini-c')
    expect(outcome.keyIndex).toBe(0)
    expect(outcome.attempts).toBe(3)
    expect(calls).toEqual(['0:gemini-a', '0:gemini-b', '0:gemini-c'])
  })

  it('bascule de clé puis de modèle pour une erreur réseau', async () => {
    const calls: string[] = []
    const outcome = await runWithFailover({
      keysLen: 2,
      models: ['gemini-a', 'gemini-b'],
      startKeyIndex: 0,
      attempt: async (keyIndex, model) => {
        calls.push(`${keyIndex}:${model}`)
        if (keyIndex === 0) await fail('ERR_NETWORK')
        if (model === 'gemini-a') await fail('ERR_NETWORK')
        return 'ok'
      }
    })
    expect(outcome.keyIndex).toBe(1)
    expect(outcome.model).toBe('gemini-b')
    expect(calls).toEqual(['0:gemini-a', '0:gemini-b', '1:gemini-a', '1:gemini-b'])
  })

  it('clé refusée (unauthorized) : passe à la clé suivante en repartant du modèle principal', async () => {
    const calls: string[] = []
    const outcome = await runWithFailover({
      keysLen: 2,
      models: ['gemini-a', 'gemini-b'],
      startKeyIndex: 0,
      attempt: async (keyIndex, model) => {
        calls.push(`${keyIndex}:${model}`)
        if (keyIndex === 0) await fail('ERR_API_UNAUTHORIZED')
        return 'ok'
      }
    })
    expect(outcome.keyIndex).toBe(1)
    expect(outcome.model).toBe('gemini-a')
    expect(calls).toEqual(['0:gemini-a', '1:gemini-a'])
  })

  it('remonte immédiatement une erreur définitive (sans gestion de bascule)', async () => {
    let calls = 0
    await expect(
      runWithFailover({
        keysLen: 2,
        models: ['gemini-a', 'gemini-b'],
        startKeyIndex: 0,
        attempt: async () => {
          calls += 1
          await fail('ERR_VALIDATION')
        }
      })
    ).rejects.toMatchObject({ code: 'ERR_VALIDATION' })
    expect(calls).toBe(1)
  })

  it('respecte l’annulation (aucune retentative après cancel)', async () => {
    let calls = 0
    await expect(
      runWithFailover({
        keysLen: 2,
        models: ['gemini-a', 'gemini-b'],
        startKeyIndex: 0,
        attempt: async () => {
          calls += 1
          await fail('ERR_CANCELLED')
        }
      })
    ).rejects.toMatchObject({ code: 'ERR_CANCELLED' })
    expect(calls).toBe(1)
  })

  it('quand toutes les combinaisons échouent, remonte la dernière erreur enrichie', async () => {
    await expect(
      runWithFailover({
        keysLen: 2,
        models: ['gemini-a', 'gemini-b'],
        startKeyIndex: 0,
        attempt: async (keyIndex, _model) => {
          await fail(keyIndex === 0 ? 'ERR_QUOTA_EXCEEDED' : 'ERR_MODEL_UNAVAILABLE')
        }
      })
    ).rejects.toMatchObject({ code: 'ERR_MODEL_UNAVAILABLE', details: { failoverAttempts: 3 } })
  })

  it('clé de départ préférée honorée (cycle circulaire)', async () => {
    const first = await runWithFailover({
      keysLen: 3,
      models: ['gemini-a'],
      startKeyIndex: 1,
      attempt: async (keyIndex) => ({ keyIndex })
    })
    expect(first.keyIndex).toBe(1)
  })

  it('sans clé : ERR_API_NOT_CONFIGURED', async () => {
    await expect(
      runWithFailover({
        keysLen: 0,
        models: ['gemini-a'],
        startKeyIndex: 0,
        attempt: async () => 'ok'
      })
    ).rejects.toMatchObject({ code: 'ERR_API_NOT_CONFIGURED' })
  })

  it('sans modèle : ERR_VALIDATION', async () => {
    await expect(
      runWithFailover({
        keysLen: 2,
        models: ['  '],
        startKeyIndex: 0,
        attempt: async () => 'ok'
      })
    ).rejects.toMatchObject({ code: 'ERR_VALIDATION' })
  })
})