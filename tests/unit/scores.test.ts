import { describe, expect, it } from 'vitest'
import { computeScores } from '@main/services/ScoresService'
import { makePayload } from '../fixtures/report'
import { SCORE_DIMENSION_LABELS } from '@shared/constants'

describe('computeScores', () => {
  it('calcule l’Indice Félicité comme moyenne pondérée des dimensions évaluables', () => {
    const payload = makePayload()
    const result = computeScores(payload, 'default')

    expect(result.scores).toHaveLength(10)
    expect(result.felicityIndex.value).not.toBeNull()

    // Vérifie le calcul manuellement : seules les dimensions non-null comptent.
    const weights = {
      visualAttraction: 0.15,
      hierarchyClarity: 0.12,
      aestheticHarmony: 0.12,
      targetConsistency: 0.1,
      perceivedValue: 0.13,
      emotionalPotential: 0.1,
      propositionClarity: 0.11,
      visualCredibility: 0.07,
      channelFit: 0.05,
      smallFormatLegibility: 0.05
    }
    let sum = 0
    let total = 0
    for (const score of result.scores) {
      if (score.value !== null) {
        sum += score.value * weights[score.dimension]
        total += weights[score.dimension]
      }
    }
    expect(result.felicityIndex.value).toBe(Math.round(sum / total))
  })

  it('retrouve les dimensions non évaluées et émet un avertissement si trop peu de données', () => {
    const payload = makePayload({
      scores: [
        {
          dimension: 'visualAttraction',
          value: 50,
          confidence: 0.5,
          justification: 'ok',
          evidence: [],
          improvements: []
        }
      ]
    })
    const result = computeScores(payload, 'default')
    expect(result.felicityIndex.notEvaluableDimensions).toContain('smallFormatLegibility')
    expect(result.warnings.some((w) => w.includes('prudence'))).toBe(true)
  })

  it('retourne un indice null si aucune dimension évaluable', () => {
    const payload = makePayload({
      scores: [
        {
          dimension: 'visualAttraction',
          value: null,
          confidence: 0.5,
          justification: 'ok',
          evidence: [],
          improvements: []
        }
      ]
    })
    const result = computeScores(payload, 'default')
    expect(result.felicityIndex.value).toBeNull()
    expect(result.warnings.some((w) => w.includes('ne peut pas être calculé'))).toBe(true)
  })

  it('ajoute une note heuristique quand la hiérarchie est très claire malgré des éléments concurrents', () => {
    const payload = makePayload({
      attentionAnalysis: {
        focalPoints: ['A'],
        visualPathHypothesis: 'x',
        competingElements: ['A', 'B', 'C'],
        confusionZones: [],
        findings: []
      },
      scores: [
        {
          dimension: 'hierarchyClarity',
          value: 90,
          confidence: 0.8,
          justification: 'très clair',
          evidence: [],
          improvements: []
        }
      ]
    })
    const result = computeScores(payload, 'default')
    const hierarchy = result.scores.find((s) => s.dimension === 'hierarchyClarity')
    expect(hierarchy?.heuristicNote).toContain('à vérifier')
    expect(result.scores.find((s) => s.dimension === 'visualAttraction')?.label).toBe(
      SCORE_DIMENSION_LABELS.visualAttraction
    )
  })

  it('retombe sur le profil par défaut si le profil demandé est inconnu', () => {
    const result = computeScores(makePayload(), 'profil_inexistant')
    expect(result.felicityIndex.weightProfile).toBe('default')
  })
})