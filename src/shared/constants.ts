/**
 * Constantes partagées entre le processus principal et le renderer.
 * Aucun secret ne doit figurer ici.
 */

import type { ScoreDimensionId } from './schemas'

export const APP_NAME = 'Design Félicité AI'
export const APP_ID = 'design-felicite-ai'
export const PROTOCOL_VERSION = 'design-analysis/v1'
export const REPORT_SCHEMA_VERSION = 'report/v1'

/** Catégories de produits proposées (l'utilisateur peut en choisir une ou laisser l'IA inférer). */
export const PRODUCT_CATEGORIES: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'bijou', label: 'Bijou' },
  { id: 'orgonite', label: 'Orgonite / objet énergétique' },
  { id: 'cosmetique', label: 'Produit cosmétique (flacon, pot)' },
  { id: 'emballage', label: 'Emballage / étiquette / coffret' },
  { id: 'alimentaire', label: 'Produit alimentaire' },
  { id: 'accessoire_mode', label: 'Accessoire de mode' },
  { id: 'electronique', label: 'Produit électronique' },
  { id: 'menager', label: 'Produit ménager' },
  { id: 'publicite', label: 'Publicité produit' },
  { id: 'photo_campagne', label: 'Photographie de campagne' },
  { id: 'logo_identite', label: 'Logo / identité visuelle' },
  { id: 'autre', label: 'Autre' }
]

/** Canaux de diffusion prévus. */
export const CHANNELS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'boutique_en_ligne', label: 'Boutique en ligne' },
  { id: 'meta_ads', label: 'Publicité Meta (Facebook/Instagram)' },
  { id: 'instagram', label: 'Instagram (organique)' },
  { id: 'packaging_physique', label: 'Packaging physique' },
  { id: 'catalogue', label: 'Catalogue / print' },
  { id: 'marketplace', label: 'Place de marché' },
  { id: 'vitrine', label: 'Vitrine / point de vente' },
  { id: 'autre', label: 'Autre' }
]

/** Modèles d'analyse (texte + vision) proposés par défaut, modifiables sans toucher au code. */
export const DEFAULT_ANALYSIS_MODEL = 'gemini-2.5-flash'
export const SUGGESTED_ANALYSIS_MODELS: ReadonlyArray<string> = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-3-flash',
  'gemini-3-pro'
]

/**
 * Plafond de jetons de sortie pour l'analyse. Les modèles 2.5/3.x consomment une part
 * importante de ce budget pour le « thinking » ; un plafond trop bas (ex. 8192) tronque
 * le JSON de sortie (finishReason = MAX_TOKENS) et fait échouer le parsing.
 */
export const ANALYSIS_MAX_OUTPUT_TOKENS = 32768

/** Modèles de génération / édition d'images proposés par défaut (distincts du modèle d'analyse). */
export const DEFAULT_IMAGE_MODEL = 'gemini-3.1-flash-image'
export const SUGGESTED_IMAGE_MODELS: ReadonlyArray<string> = [
  'gemini-3.1-flash-image',
  'gemini-3.1-flash-lite-image',
  'gemini-3-pro-image',
  'gemini-2.5-flash-image'
]

/** Libellés français des dimensions de score. */
export const SCORE_DIMENSION_LABELS: Record<ScoreDimensionId, string> = {
  visualAttraction: 'Attraction visuelle',
  hierarchyClarity: 'Clarté de la hiérarchie',
  aestheticHarmony: 'Harmonie esthétique',
  targetConsistency: 'Cohérence avec la cible',
  perceivedValue: 'Valeur perçue',
  emotionalPotential: 'Potentiel émotionnel',
  propositionClarity: 'Compréhension de la proposition',
  visualCredibility: 'Crédibilité visuelle',
  channelFit: 'Adaptation au canal',
  smallFormatLegibility: 'Lisibilité en petit format'
}

export const SCORE_DIMENSIONS: ReadonlyArray<ScoreDimensionId> = Object.keys(
  SCORE_DIMENSION_LABELS
) as ScoreDimensionId[]

/**
 * Profils de pondération de l'Indice Félicité.
 * Chaque profil associe un poids à chaque dimension. La somme des poids doit valoir 1.
 * Ce sont des heuristiques internes, configurables, PAS des probabilités d'achat.
 */
export type WeightProfile = Record<ScoreDimensionId, number>

export const WEIGHT_PROFILES: Record<string, { label: string; weights: WeightProfile }> = {
  default: {
    label: 'Équilibré (par défaut)',
    weights: {
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
  },
  packaging: {
    label: 'Emballage (lisibilité prioritaire)',
    weights: {
      visualAttraction: 0.1,
      hierarchyClarity: 0.16,
      aestheticHarmony: 0.1,
      targetConsistency: 0.1,
      perceivedValue: 0.12,
      emotionalPotential: 0.08,
      propositionClarity: 0.16,
      visualCredibility: 0.08,
      channelFit: 0.05,
      smallFormatLegibility: 0.05
    }
  },
  bijou: {
    label: 'Bijou / premium (raffinement prioritaire)',
    weights: {
      visualAttraction: 0.16,
      hierarchyClarity: 0.08,
      aestheticHarmony: 0.17,
      targetConsistency: 0.09,
      perceivedValue: 0.17,
      emotionalPotential: 0.14,
      propositionClarity: 0.06,
      visualCredibility: 0.07,
      channelFit: 0.03,
      smallFormatLegibility: 0.03
    }
  },
  cosmetique: {
    label: 'Cosmétique (désir + confiance)',
    weights: {
      visualAttraction: 0.15,
      hierarchyClarity: 0.12,
      aestheticHarmony: 0.14,
      targetConsistency: 0.11,
      perceivedValue: 0.13,
      emotionalPotential: 0.1,
      propositionClarity: 0.12,
      visualCredibility: 0.07,
      channelFit: 0.03,
      smallFormatLegibility: 0.03
    }
  },
  electronique: {
    label: 'Électronique (clarté + crédibilité)',
    weights: {
      visualAttraction: 0.12,
      hierarchyClarity: 0.14,
      aestheticHarmony: 0.1,
      targetConsistency: 0.1,
      perceivedValue: 0.12,
      emotionalPotential: 0.06,
      propositionClarity: 0.16,
      visualCredibility: 0.12,
      channelFit: 0.05,
      smallFormatLegibility: 0.03
    }
  }
}

/** Associe une catégorie de produit au profil de pondération le plus pertinent. */
export const CATEGORY_WEIGHT_PROFILE: Record<string, string> = {
  bijou: 'bijou',
  orgonite: 'bijou',
  cosmétique: 'cosmetique',
  cosmetique: 'cosmetique',
  emballage: 'packaging',
  alimentaire: 'packaging',
  accessoire_mode: 'bijou',
  electronique: 'electronique',
  menager: 'electronique',
  publicite: 'default',
  photo_campagne: 'default',
  logo_identite: 'default',
  autre: 'default'
}

/** Limites de sécurité pour l'import d'images. */
export const IMAGE_LIMITS = {
  maxBytes: 20 * 1024 * 1024,
  maxPixelsPerSide: 8000,
  /** Taille maximale envoyée au modèle d'analyse (économie de jetons). */
  maxUploadSide: 1600,
  acceptedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'] as ReadonlyArray<string>
}

/** Extensions acceptées à l'import. */
export const ACCEPTED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'] as ReadonlyArray<string>

/** Grand nombre de tentatives de réparation d'une réponse modèle invalide. */
export const MAX_REPAIR_ATTEMPTS = 2

/** Délais (ms) par défaut. */
export const TIMEOUTS = {
  analysisMs: 120_000,
  connectionTestMs: 20_000,
  imageGenerationMs: 180_000
}
