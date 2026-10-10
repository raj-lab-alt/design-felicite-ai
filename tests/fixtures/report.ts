import type { DesignReport, ModelReportPayload } from '@shared/schemas'
import { modelReportPayloadSchema, designReportSchema, SCORE_DIMENSION_IDS } from '@shared/schemas'

/** Jeu de dimensions avec des valeurs distinctes pour vérifier la pondération. */
const VALUES: Record<string, number | null> = {
  visualAttraction: 90,
  hierarchyClarity: 80,
  aestheticHarmony: 85,
  targetConsistency: 70,
  perceivedValue: 88,
  emotionalPotential: null, // non évalué volontairement
  propositionClarity: 75,
  visualCredibility: 60,
  channelFit: 65,
  smallFormatLegibility: 50
}

/** Génère un payload de modèle valide selon le schéma zod. */
export function makePayload(overrides: Partial<ModelReportPayload> = {}): ModelReportPayload {
  const payload = {
    productCategory: { label: 'Bijou', confidence: 0.9 },
    productSummary: 'Un collier artisanal en orgonite, photographié sur fond neutre.',
    detectedFeatures: {
      visible: ['Chaîne dorée', 'Pierre polie', 'Fond beige'],
      inferred: ['Fait main', 'Matériaux naturels'],
      colors: ['Or', 'Terre'],
      materials: ['Métal doré', 'Résine'],
      style: 'Artisanal, chaleureux',
      composition: 'Produit centré, faible décor',
      complexity: 'faible'
    },
    assumptions: ['Le produit est vendu en ligne.'],
    limitations: ['L’échelle réelle de la pierre est inconnue.'],
    attentionAnalysis: {
      focalPoints: ['La pierre'],
      visualPathHypothesis: 'Le regard va de la pierre vers la chaîne.',
      competingElements: ['Fond uni'],
      confusionZones: [],
      findings: ['Peu d’éléments concurrents.']
    },
    visualHierarchy: [{ level: 1, element: 'La pierre', note: 'Point focal principal' }],
    aestheticAnalysis: [
      { aspect: 'Équilibre', observation: 'Composition centrée', assessment: 'Stable et reposante' }
    ],
    emotionalHypotheses: [
      { emotion: 'Sérénité', hypothesis: 'Les tons terre inspirent le calme.', supportingElements: ['Palette chaude'], conditions: 'Si le fond reste neutre.' }
    ],
    perceivedValueAnalysis: {
      summary: 'La présentation évoque un objet précieux.',
      valueIncreasers: ['Matière authentique'],
      valueReducers: ['Aucune information sur la taille'],
      unknownInformation: ['Le prix n’est pas visible sur l’image.']
    },
    commercialFriction: {
      summary: 'Le bénéfice est lisible mais peu explicit.',
      benefitVisibility: 'Modérée',
      purchaseReasonsClarity: 'Bonne',
      differentiation: 'Faible',
      reassuranceElements: [],
      frictionPoints: []
    },
    felicityPoint: {
      recommendedFocalElement: 'La pierre',
      placement: 'Centré',
      relativeSize: '60 % de la hauteur',
      colorFinishTexture: 'Or doux, finition satinée',
      elementsToKeep: ['La chaîne', 'Le fond neutre'],
      elementsToReduceOrRemove: ['Le décor'],
      contrastToStrengthen: 'Entre la pierre et le fond',
      complexityGuidance: 'Rester simple',
      primaryEmotionOrValue: 'Sérénité',
      compromiseExplanation: 'Le design actuel privilégie le calme au détriment de l’information.'
    },
    scores: SCORE_DIMENSION_IDS.map((dimension, i) => ({
      dimension,
      value: VALUES[dimension] ?? null,
      confidence: 0.8 - i * 0.02,
      justification: `Justification pour ${dimension}.`,
      evidence: ['Observation 1'],
      improvements: ['Piste 1']
    })),
    priorityRecommendations: [
      {
        id: 'rec-1',
        title: 'Rendre le prix visible',
        description: 'Indiquer la gamme de prix sous le produit.',
        observedProblem: 'Le client ne peut pas évaluer le prix.',
        proposedChange: 'Ajouter un bandeau discret avec la gamme de prix.',
        justification: 'Réduit le frein à l’achat.',
        expectedImpact: 'high',
        confidence: 0.7,
        estimatedCost: 'Faible',
        tradeoffs: ['Peut alourdir la composition'],
        suggestedTest: 'Mesurer le taux de clic',
        priority: 1
      },
      {
        id: 'rec-2',
        title: 'Renforcer le fond',
        description: 'Un fond légèrement texturé pour la profondeur.',
        observedProblem: 'Fond trop neutre.',
        proposedChange: 'Ajouter une texture discrète.',
        justification: 'Augmente le réalisme.',
        expectedImpact: 'medium',
        confidence: 0.6,
        estimatedCost: 'Nulle',
        tradeoffs: [],
        suggestedTest: 'Comparer les clics',
        priority: 2
      }
    ],
    preserveElements: ['La chaîne', 'La pierre'],
    avoidElements: ['Fonds criards', 'Textes inventés'],
    redesignBrief: {
      artDirection: 'Natural et chaleureux',
      shapesToChange: ['Arrondir les angles du socle'],
      focalPointPosition: 'Légèrement décalé à droite',
      relativeProportions: 'Préserver les proportions actuelles',
      colorPalette: ['Or', 'Terre', 'Ivoire'],
      materialsAndFinishes: 'Or satiné, pierre polie',
      elementsToPreserve: ['La pierre', 'La chaîne'],
      elementsToAvoid: ['Reflets agressifs'],
      expectedRealism: 'Photographie produit réaliste',
      manufacturingConstraints: 'Aucun procédé contraint',
      primaryCommercialObjective: 'Vendre le collier en ligne'
    },
    testingPlan: [
      { step: 'Lancer la nouvelle version', metric: 'ctr', note: 'en publicité Meta' }
    ],
    finalDecision: {
      diagnosis: 'Un design calme et cohérent, à personnaliser légèrement.',
      threePriorities: ['Rendre le prix visible', 'Renforcer le fond', 'Éclaircir la promesse'],
      preserve: ['La pierre', 'La chaîne'],
      avoid: ['Décor excessif'],
      artDirection: 'Natural et chaleureux',
      validationPlan: 'Tester en boutiques en ligne puis sur les réseaux.'
    },
    confidence: 0.82
  } satisfies ModelReportPayload

  const merged = { ...payload, ...overrides }
  return modelReportPayloadSchema.parse(merged)
}

/** Génère un rapport final persisté valide. */
export function makeReport(overrides: Partial<ModelReportPayload> = {}): DesignReport {
  const payload = makePayload(overrides)
  return designReportSchema.parse({
    ...payload,
    analysisId: 'an-test-1',
    protocolVersion: 'design-analysis/v1',
    scores: payload.scores.map((score) => ({
      ...score,
      label: score.dimension,
      weight: 0.1,
      heuristicNote: null
    })),
    felicityIndex: {
      value: 80,
      weightProfile: 'default',
      formula: 'Moyenne pondérée.',
      notEvaluableDimensions: []
    },
    modelMetadata: {
      provider: 'test',
      model: 'gemini-test',
      protocolVersion: 'design-analysis/v1',
      reportSchemaVersion: 'report/v1',
      generatedAt: new Date().toISOString(),
      durationMs: 500,
      usage: { promptTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCostUsd: 0.001 }
    }
  })
}