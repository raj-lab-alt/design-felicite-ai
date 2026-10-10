import { CHANNELS, PRODUCT_CATEGORIES } from '@shared/constants'
import type { AnalysisContext, BrandProfile } from '@shared/schemas'

function labelFor(items: ReadonlyArray<{ id: string; label: string }>, id?: string): string | null {
  if (!id) return null
  return items.find((i) => i.id === id)?.label ?? null
}

export function buildAnalysisInstruction(context: AnalysisContext, brandProfile: BrandProfile | null): string {
  const lines: string[] = []

  lines.push('Contexte commercial fourni par l’analyste (à prendre en compte, sans jamais inventer ce qui manque) :')
  const ctx: Array<[string, string | undefined | null]> = [
    ['Produit', context.productName],
    ['Catégorie', labelFor(PRODUCT_CATEGORIES, context.categoryId) ?? context.categoryId],
    ['Description', context.description],
    ['Prix indicatif', context.price],
    ['Marché', context.market],
    ['Audience cible', context.audience],
    ['Canal de diffusion', labelFor(CHANNELS, context.channelId) ?? context.channelId],
    ['Promesse commerciale', context.promise],
    ['Positionnement', context.positioning],
    ['Contraintes connues', context.constraints],
    ['Éléments concurrentiels', context.competitors],
    ['Objectif', context.objective]
  ]
  for (const [k, v] of ctx) {
    if (v) lines.push(`- ${k} : ${v}`)
  }

  if (brandProfile) {
    lines.push('')
    lines.push('Profil de marque à respecter :')
    const bp: Array<[string, unknown]> = [
      ['Description', brandProfile.description],
      ['Secteur', brandProfile.sector],
      ['Marché', brandProfile.market],
      ['Audience', brandProfile.audience],
      ['Positionnement', brandProfile.positioning],
      ['Ton visuel', brandProfile.visualTone],
      ['Palette recommandée', brandProfile.recommendedPalette.join(', ')],
      ['Couleurs à éviter', brandProfile.colorsToAvoid.join(', ')],
      ['Type de qualité', brandProfile.qualityType],
      ['Gamme de prix', brandProfile.priceRange],
      ['Contraintes de fabrication', brandProfile.manufacturingConstraints],
      ['Valeurs de marque', brandProfile.brandValues.join(', ')],
      ['Promesses autorisées', brandProfile.allowedPromises.join(', ')],
      ['Promesses interdites', brandProfile.forbiddenPromises.join(', ')],
      ['Références visuelles', brandProfile.visualReferences.join(', ')],
      ['Style photo', brandProfile.photoStyle],
      ['Positionnement concurrentiel', brandProfile.competitivePositioning]
    ]
    for (const [k, v] of bp) {
      if (v) lines.push(`- ${k} : ${String(v)}`)
    }
  }

  lines.push('')
  lines.push(
    "Consignes : analysez l’image jointe selon le protocole fourni, étape par étape. Distinguez toujours les faits visiblement présents dans l'image, les hypothèses raisonnables et les inconnues. Ne faites aucune promesse de chiffres, de taux d'achat ou de résultats commerciaux : le score reste une évaluation heuristique de conception, pas une prédiction de vente. N'inventez aucun élément non visible ni aucune information absente du contexte. Évaluez les 10 dimensions du score avec une valeur de 0 à 100 (ou null si aucune information exploitable). Fournissez exactement le JSON attendu par le schéma, sans texte autour."
  )

  return lines.join('\n')
}

/** Suffixe ajouté lors des tentatives de réparation d'une réponse invalide. */
export function buildRepairSuffix(parseErrors: string[]): string {
  const errors = parseErrors.slice(0, 6).map((e) => `- ${e}`).join('\n')
  return `\n\nVotre réponse précédente était invalide. Erreurs détectées :\n${errors}\n\nRenvoyez UNIQUEMENT un objet JSON strictement conforme au schéma fourni, complet et sans texte autour.`
}

/** Nettoie et tente d'extraire un objet JSON d'une réponse contenant éventuellement des marqueurs markdown. */
export function extractJson(text: string): unknown {
  let trimmed = text.trim()
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  if (fence) trimmed = fence[1].trim()
  return JSON.parse(trimmed)
}