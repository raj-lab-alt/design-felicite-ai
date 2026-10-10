import {
  SCORE_DIMENSIONS,
  SCORE_DIMENSION_LABELS,
  WEIGHT_PROFILES
} from '@shared/constants'
import type {
  FelicityIndex,
  ModelReportPayload,
  ScoreEntry,
  ScoreEntryModel,
  ScoreDimensionId
} from '@shared/schemas'

export interface ComputedScores {
  scores: ScoreEntry[]
  felicityIndex: FelicityIndex
  warnings: string[]
}

function resolveProfile(profileId: string): { id: string; weights: Record<ScoreDimensionId, number> } {
  const profile = WEIGHT_PROFILES[profileId] ?? WEIGHT_PROFILES.default
  const id = WEIGHT_PROFILES[profileId] ? profileId : 'default'
  return { id, weights: profile.weights }
}

/** Contrôles heuristiques locaux : détectent des incohérences possibles entre scores et observations. */
function heuristicChecks(payload: ModelReportPayload, model: ScoreEntryModel, dim: ScoreDimensionId): string | null {
  const value = model.value
  if (value === null) return null
  if (dim === 'hierarchyClarity' && value >= 85 && payload.attentionAnalysis.competingElements.length >= 3) {
    return 'Hiérarchie jugée très claire alors que plusieurs éléments concurrents sont signalés : à vérifier.'
  }
  if (
    dim === 'propositionClarity' &&
    value >= 85 &&
    payload.commercialFriction.frictionPoints.length >= 3
  ) {
    return 'Compréhension jugée très bonne alors que plusieurs freins à l’achat sont signalés : à vérifier.'
  }
  if (
    dim === 'perceivedValue' &&
    value >= 85 &&
    payload.perceivedValueAnalysis.unknownInformation.length >= 2
  ) {
    return 'Valeur perçue jugée très élevée alors que des informations clés (prix, marché) sont inconnues.'
  }
  if (dim === 'emotionalPotential' && value >= 90 && payload.emotionalHypotheses.length === 0) {
    return 'Potentiel émotionnel très élevé sans hypothèses émotionnelles explicites.'
  }
  return null
}

export function computeScores(payload: ModelReportPayload, weightProfileId: string): ComputedScores {
  const { id: profileId, weights } = resolveProfile(weightProfileId)
  const modelByDim = new Map<ScoreDimensionId, ScoreEntryModel>()
  for (const entry of payload.scores) modelByDim.set(entry.dimension, entry)

  const warnings: string[] = []
  const notEvaluable: ScoreDimensionId[] = []
  const scores: ScoreEntry[] = []
  let weightedSum = 0
  let weightTotal = 0

  for (const dim of SCORE_DIMENSIONS) {
    const weight = weights[dim] ?? 0
    const model = modelByDim.get(dim)
    const heuristicNote = model ? heuristicChecks(payload, model, dim) : null
    if (!model) {
      notEvaluable.push(dim)
      scores.push({
        dimension: dim,
        label: SCORE_DIMENSION_LABELS[dim],
        value: null,
        weight,
        confidence: 0,
        justification: 'Dimension non évaluée par le modèle.',
        evidence: [],
        improvements: [],
        heuristicNote: null
      })
      continue
    }
    if (model.value === null) {
      notEvaluable.push(dim)
    } else {
      weightedSum += model.value * weight
      weightTotal += weight
    }
    scores.push({
      dimension: dim,
      label: SCORE_DIMENSION_LABELS[dim],
      value: model.value,
      weight,
      confidence: model.confidence,
      justification: model.justification,
      evidence: model.evidence,
      improvements: model.improvements,
      heuristicNote
    })
  }

  let indexValue: number | null = null
  if (weightTotal > 0) {
    indexValue = Math.round(weightedSum / weightTotal)
  } else {
    warnings.push('Aucune dimension évaluable : l’Indice Félicité ne peut pas être calculé.')
  }

  const evaluableCount = scores.filter((s) => s.value !== null).length
  if (evaluableCount < 5) {
    warnings.push(
      'Moins de la moitié des dimensions sont évaluées : interpréter l’Indice Félicité avec prudence.'
    )
  }

  const weightList = scores
    .filter((s) => s.value !== null)
    .map((s) => `${SCORE_DIMENSION_LABELS[s.dimension]} (poids ${(s.weight * 100).toFixed(0)}%)`)
    .join(', ')

  const formula =
    indexValue === null
      ? 'Indice non calculable (aucune dimension évaluable).'
      : `Moyenne pondérée des dimensions évaluables — ${weightList}.`

  return {
    scores,
    felicityIndex: {
      value: indexValue,
      weightProfile: profileId,
      formula,
      notEvaluableDimensions: notEvaluable
    },
    warnings
  }
}
