/**
 * Schémas de validation (zod) partagés.
 * - Les schémas marqués « modèle » décrivent ce que Gemini doit produire.
 * - Les schémas « rapport » décrivent l'objet final persisté (champs techniques injectés par l'app).
 * Toute donnée entrante (IPC, API, base) est validée par ces schémas avant usage.
 */

import { z } from 'zod'
import { DEFAULT_ANALYSIS_MODEL, DEFAULT_IMAGE_MODEL } from './constants'

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

export const confidenceSchema = z.number().min(0).max(1)
export const scoreValueSchema = z.number().min(0).max(100)

export const SCORE_DIMENSION_IDS = [
  'visualAttraction',
  'hierarchyClarity',
  'aestheticHarmony',
  'targetConsistency',
  'perceivedValue',
  'emotionalPotential',
  'propositionClarity',
  'visualCredibility',
  'channelFit',
  'smallFormatLegibility'
] as const

export const scoreDimensionSchema = z.enum(SCORE_DIMENSION_IDS)
export type ScoreDimensionId = z.infer<typeof scoreDimensionSchema>

export const impactSchema = z.enum(['low', 'medium', 'high'])
export type Impact = z.infer<typeof impactSchema>

/* ------------------------------------------------------------------ */
/* Rapport produit par le modèle                                       */
/* ------------------------------------------------------------------ */

export const scoreEntryModelSchema = z.object({
  dimension: scoreDimensionSchema,
  value: scoreValueSchema.nullable(),
  confidence: confidenceSchema,
  justification: z.string().max(2000),
  evidence: z.array(z.string().max(500)).max(12).default([]),
  improvements: z.array(z.string().max(500)).max(12).default([])
})
export type ScoreEntryModel = z.infer<typeof scoreEntryModelSchema>

export const recommendationModelSchema = z.object({
  id: z.string().min(1).max(60),
  title: z.string().min(1).max(200),
  description: z.string().max(2000),
  observedProblem: z.string().max(1500),
  proposedChange: z.string().max(1500),
  justification: z.string().max(1500),
  expectedImpact: impactSchema,
  confidence: confidenceSchema,
  estimatedCost: z.string().max(300).nullable().default(null),
  tradeoffs: z.array(z.string().max(400)).max(10).default([]),
  suggestedTest: z.string().max(1000),
  priority: z.number().int().min(1).max(20)
})
export type RecommendationModel = z.infer<typeof recommendationModelSchema>

export const redesignBriefSchema = z.object({
  artDirection: z.string().max(2000),
  shapesToChange: z.array(z.string().max(500)).max(20).default([]),
  focalPointPosition: z.string().max(600),
  relativeProportions: z.string().max(600),
  colorPalette: z.array(z.string().max(120)).max(24).default([]),
  materialsAndFinishes: z.string().max(800),
  elementsToPreserve: z.array(z.string().max(400)).max(24).default([]),
  elementsToAvoid: z.array(z.string().max(400)).max(24).default([]),
  expectedRealism: z.string().max(600),
  manufacturingConstraints: z.string().max(800),
  primaryCommercialObjective: z.string().max(500)
})
export type RedesignBrief = z.infer<typeof redesignBriefSchema>

export const modelReportPayloadSchema = z.object({
  productCategory: z.object({
    label: z.string().max(120),
    confidence: confidenceSchema
  }),
  productSummary: z.string().max(2000),
  detectedFeatures: z.object({
    visible: z.array(z.string().max(400)).max(24).default([]),
    inferred: z.array(z.string().max(400)).max(24).default([]),
    colors: z.array(z.string().max(120)).max(24).default([]),
    materials: z.array(z.string().max(160)).max(24).default([]),
    style: z.string().max(400),
    composition: z.string().max(600),
    complexity: z.enum(['faible', 'moderee', 'elevee'])
  }),
  assumptions: z.array(z.string().max(500)).max(24).default([]),
  limitations: z.array(z.string().max(500)).max(24).default([]),
  attentionAnalysis: z.object({
    focalPoints: z.array(z.string().max(300)).max(12).default([]),
    visualPathHypothesis: z.string().max(1200),
    competingElements: z.array(z.string().max(300)).max(12).default([]),
    confusionZones: z.array(z.string().max(300)).max(12).default([]),
    findings: z.array(z.string().max(500)).max(16).default([])
  }),
  visualHierarchy: z
    .array(
      z.object({
        level: z.number().int().min(1).max(10),
        element: z.string().max(200),
        note: z.string().max(400)
      })
    )
    .max(12)
    .default([]),
  aestheticAnalysis: z
    .array(
      z.object({
        aspect: z.string().max(200),
        observation: z.string().max(600),
        assessment: z.string().max(600)
      })
    )
    .max(20)
    .default([]),
  emotionalHypotheses: z
    .array(
      z.object({
        emotion: z.string().max(120),
        hypothesis: z.string().max(600),
        supportingElements: z.array(z.string().max(300)).max(8).default([]),
        conditions: z.string().max(600)
      })
    )
    .max(16)
    .default([]),
  perceivedValueAnalysis: z.object({
    summary: z.string().max(1200),
    valueIncreasers: z.array(z.string().max(400)).max(16).default([]),
    valueReducers: z.array(z.string().max(400)).max(16).default([]),
    unknownInformation: z.array(z.string().max(400)).max(16).default([])
  }),
  commercialFriction: z.object({
    summary: z.string().max(1200),
    benefitVisibility: z.string().max(800),
    purchaseReasonsClarity: z.string().max(800),
    differentiation: z.string().max(800),
    reassuranceElements: z.array(z.string().max(400)).max(16).default([]),
    frictionPoints: z.array(z.string().max(400)).max(16).default([])
  }),
  felicityPoint: z.object({
    recommendedFocalElement: z.string().max(400),
    placement: z.string().max(400),
    relativeSize: z.string().max(400),
    colorFinishTexture: z.string().max(600),
    elementsToKeep: z.array(z.string().max(300)).max(16).default([]),
    elementsToReduceOrRemove: z.array(z.string().max(300)).max(16).default([]),
    contrastToStrengthen: z.string().max(400),
    complexityGuidance: z.string().max(600),
    primaryEmotionOrValue: z.string().max(300),
    compromiseExplanation: z.string().max(1200)
  }),
  scores: z.array(scoreEntryModelSchema).min(1).max(12),
  priorityRecommendations: z.array(recommendationModelSchema).max(12).default([]),
  preserveElements: z.array(z.string().max(300)).max(24).default([]),
  avoidElements: z.array(z.string().max(300)).max(24).default([]),
  redesignBrief: redesignBriefSchema,
  testingPlan: z
    .array(
      z.object({
        step: z.string().max(500),
        metric: z.string().max(200),
        note: z.string().max(500)
      })
    )
    .max(12)
    .default([]),
  finalDecision: z.object({
    diagnosis: z.string().max(1500),
    threePriorities: z.array(z.string().max(400)).max(5).default([]),
    preserve: z.array(z.string().max(300)).max(16).default([]),
    avoid: z.array(z.string().max(300)).max(16).default([]),
    artDirection: z.string().max(1200),
    validationPlan: z.string().max(1500)
  }),
  confidence: confidenceSchema
})
export type ModelReportPayload = z.infer<typeof modelReportPayloadSchema>

/** Schéma JSON transmis à Gemini pour contraindre la sortie (généré depuis le schéma zod). */
export function modelReportJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(modelReportPayloadSchema, {
    target: 'draft-07',
    io: 'input',
    unrepresentable: 'any'
  }) as Record<string, unknown>
}

/* ------------------------------------------------------------------ */
/* Rapport final persisté                                              */
/* ------------------------------------------------------------------ */

export const usageMetadataSchema = z
  .object({
    promptTokens: z.number().int().nonnegative().nullable().default(null),
    outputTokens: z.number().int().nonnegative().nullable().default(null),
    totalTokens: z.number().int().nonnegative().nullable().default(null),
    estimatedCostUsd: z.number().nonnegative().nullable().default(null)
  })
  .nullable()
export type UsageMetadata = z.infer<typeof usageMetadataSchema>

export const felicityIndexSchema = z.object({
  value: scoreValueSchema.nullable(),
  weightProfile: z.string().max(60),
  formula: z.string().max(600),
  notEvaluableDimensions: z.array(scoreDimensionSchema).max(10).default([])
})
export type FelicityIndex = z.infer<typeof felicityIndexSchema>

export const scoreEntrySchema = scoreEntryModelSchema.extend({
  label: z.string().max(120),
  weight: z.number().min(0).max(1),
  /** Écart éventuel entre le score du modèle et le contrôle heuristique local. */
  heuristicNote: z.string().max(500).nullable().default(null)
})
export type ScoreEntry = z.infer<typeof scoreEntrySchema>

export const modelMetadataSchema = z.object({
  provider: z.string().max(60),
  model: z.string().max(120),
  protocolVersion: z.string().max(60),
  reportSchemaVersion: z.string().max(60),
  generatedAt: z.string(),
  durationMs: z.number().int().nonnegative(),
  usage: usageMetadataSchema
})
export type ModelMetadata = z.infer<typeof modelMetadataSchema>

export const designReportSchema = modelReportPayloadSchema.extend({
  analysisId: z.string().min(1),
  protocolVersion: z.string().max(60),
  scores: z.array(scoreEntrySchema).min(1).max(12),
  felicityIndex: felicityIndexSchema,
  modelMetadata: modelMetadataSchema
})
export type DesignReport = z.infer<typeof designReportSchema>

/* ------------------------------------------------------------------ */
/* Contexte d'analyse & entrées utilisateur                            */
/* ------------------------------------------------------------------ */

export const analysisObjectiveSchema = z.enum([
  'vente',
  'notoriete',
  'premium',
  'lancement',
  'autre'
])
export type AnalysisObjective = z.infer<typeof analysisObjectiveSchema>

export const analysisContextSchema = z.object({
  productName: z.string().max(200).optional(),
  categoryId: z.string().max(60).optional(),
  description: z.string().max(4000).optional(),
  price: z.string().max(120).optional(),
  market: z.string().max(200).optional(),
  audience: z.string().max(800).optional(),
  channelId: z.string().max(60).optional(),
  promise: z.string().max(1500).optional(),
  positioning: z.string().max(1500).optional(),
  constraints: z.string().max(3000).optional(),
  competitors: z.string().max(3000).optional(),
  objective: analysisObjectiveSchema.optional()
})
export type AnalysisContext = z.infer<typeof analysisContextSchema>

/* ------------------------------------------------------------------ */
/* Profils de marque                                                   */
/* ------------------------------------------------------------------ */

export const brandProfileInputSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).default(''),
  sector: z.string().max(200).default(''),
  market: z.string().max(200).default(''),
  audience: z.string().max(800).default(''),
  positioning: z.string().max(1500).default(''),
  visualTone: z.string().max(800).default(''),
  recommendedPalette: z.array(z.string().max(60)).max(24).default([]),
  colorsToAvoid: z.array(z.string().max(60)).max(24).default([]),
  qualityType: z.string().max(300).default(''),
  priceRange: z.string().max(120).default(''),
  manufacturingConstraints: z.string().max(2000).default(''),
  brandValues: z.array(z.string().max(160)).max(24).default([]),
  allowedPromises: z.array(z.string().max(400)).max(24).default([]),
  forbiddenPromises: z.array(z.string().max(400)).max(24).default([]),
  visualReferences: z.array(z.string().max(600)).max(24).default([]),
  photoStyle: z.string().max(800).default(''),
  competitivePositioning: z.string().max(1500).default('')
})
export type BrandProfileInput = z.infer<typeof brandProfileInputSchema>

export const brandProfileSchema = brandProfileInputSchema.extend({
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string()
})
export type BrandProfile = z.infer<typeof brandProfileSchema>

/* ------------------------------------------------------------------ */
/* Redesign & génération d'images                                      */
/* ------------------------------------------------------------------ */

export const redesignModeSchema = z.enum(['faithful', 'premium'])
export type RedesignMode = z.infer<typeof redesignModeSchema>

export const redesignGenerateRequestSchema = z.object({
  projectId: z.string().min(1),
  analysisId: z.string().min(1),
  /** Image de référence : l'original ou une variante générée précédemment. */
  sourceImageId: z.string().min(1),
  sourceVariantId: z.string().nullable().optional(),
  mode: redesignModeSchema.default('faithful'),
  selectedRecommendationIds: z.array(z.string().max(60)).max(50).default([]),
  extraInstruction: z.string().max(3000).default(''),
  /** Prompt/brief éventuellement modifié manuellement ; sinon reconstruit automatiquement. */
  workingPrompt: z.string().max(40000).optional()
})
export type RedesignGenerateRequest = z.infer<typeof redesignGenerateRequestSchema>

export const redesignPromptRequestSchema = redesignGenerateRequestSchema.omit({
  sourceImageId: true
}).extend({
  sourceImageId: z.string().min(1)
})
export type RedesignPromptRequest = z.infer<typeof redesignPromptRequestSchema>

/* ------------------------------------------------------------------ */
/* Expérimentation                                                     */
/* ------------------------------------------------------------------ */

export const experimentMetricSchema = z.enum([
  'ctr',
  'cost_per_visit',
  'cost_per_qualified_conversation',
  'conversion_rate',
  'cost_per_confirmed_order',
  'delivery_confirmation_rate',
  'other'
])
export type ExperimentMetric = z.infer<typeof experimentMetricSchema>

export const experimentCreateSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1).max(200),
  hypothesis: z.string().max(3000).default(''),
  variantAId: z.string().nullable().optional(),
  variantBId: z.string().nullable().optional(),
  audience: z.string().max(800).default(''),
  channel: z.string().max(200).default(''),
  primaryMetric: experimentMetricSchema.default('ctr'),
  notes: z.string().max(3000).default('')
})
export type ExperimentCreate = z.infer<typeof experimentCreateSchema>

export const experimentResultInputSchema = z.object({
  variant: z.enum(['original', 'A', 'B']),
  metric: experimentMetricSchema,
  value: z.number(),
  sampleSize: z.number().int().nonnegative().nullable().optional(),
  source: z.string().max(200).default('manuel'),
  note: z.string().max(1000).default('')
})
export type ExperimentResultInput = z.infer<typeof experimentResultInputSchema>

/* ------------------------------------------------------------------ */
/* Paramètres applicatifs (non secrets)                                */
/* ------------------------------------------------------------------ */

export const appSettingsSchema = z.object({
  language: z.enum(['fr', 'en']).default('fr'),
  analysisModel: z.string().min(1).max(120).default(DEFAULT_ANALYSIS_MODEL),
  imageModel: z.string().min(1).max(120).default(DEFAULT_IMAGE_MODEL),
  imageGenerationEnabled: z.boolean().default(false),
  qualityPreset: z.enum(['economy', 'balanced', 'quality']).default('balanced'),
  maxUploadSide: z.number().int().min(512).max(4096).default(1600),
  defaultWeightProfile: z.string().max(60).default('default'),
  privacyConsentGivenAt: z.string().nullable().default(null),
  keepExports: z.boolean().default(false),
  /** Dernier test de connexion à l'API Gemini (affiché dans Paramètres, jamais de secret). */
  lastApiTestAt: z.string().nullable().default(null),
  lastApiTestOk: z.boolean().nullable().default(null),
  analysisInputPricePerMTok: z.number().nonnegative().default(0),
  analysisOutputPricePerMTok: z.number().nonnegative().default(0),
  imagePricePerImage: z.number().nonnegative().default(0.04)
})
export type AppSettings = z.infer<typeof appSettingsSchema>

export const appSettingsPatchSchema = appSettingsSchema.partial()
export type AppSettingsPatch = z.infer<typeof appSettingsPatchSchema>

/* ------------------------------------------------------------------ */
/* Divers IPC                                                          */
/* ------------------------------------------------------------------ */

export const idSchema = z.string().min(1).max(80)

export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  brandProfileId: z.string().max(80).nullable().optional()
})
export type CreateProject = z.infer<typeof createProjectSchema>

export const updateProjectSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(200).optional(),
  brandProfileId: z.string().max(80).nullable().optional(),
  favorite: z.boolean().optional(),
  archived: z.boolean().optional()
})
export type UpdateProject = z.infer<typeof updateProjectSchema>

export const analysisRunRequestSchema = z.object({
  projectId: idSchema,
  imageId: idSchema,
  context: analysisContextSchema.default({}),
  brandProfileId: z.string().max(80).nullable().optional()
})
export type AnalysisRunRequest = z.infer<typeof analysisRunRequestSchema>

export const selectRecommendationsSchema = z.object({
  analysisId: idSchema,
  selectedIds: z.array(z.string().max(60)).max(50)
})

export const exportRequestSchema = z.object({
  projectId: idSchema,
  analysisId: idSchema,
  format: z.enum(['pdf', 'json'])
})
export type ExportRequest = z.infer<typeof exportRequestSchema>
