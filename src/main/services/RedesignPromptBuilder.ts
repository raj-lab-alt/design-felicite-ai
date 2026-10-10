import type { BrandProfile, DesignReport, RedesignMode } from '@shared/schemas'

export interface RedesignPromptInput {
  report: DesignReport
  mode: RedesignMode
  selectedRecommendationIds: string[]
  extraInstruction: string
  brandProfile?: BrandProfile | null
}

export interface BuiltRedesignPrompt {
  prompt: string
  warnings: string[]
}

/**
 * Construit le prompt d'édition d'image à partir du rapport d'analyse.
 * Le prompt est rédigé en anglais (meilleur rendu des modèles d'image) tout en
 * restant affiché tel quel à l'utilisateur.
 * Règle absolue : ne modifier QUE les éléments listés ; tout le reste est préservé.
 */
export function buildRedesignPrompt(input: RedesignPromptInput): BuiltRedesignPrompt {
  const { report, mode, selectedRecommendationIds, extraInstruction, brandProfile } = input
  const warnings: string[] = []
  const brief = report.redesignBrief

  const selected = report.priorityRecommendations.filter((r) =>
    selectedRecommendationIds.includes(r.id)
  )
  if (selectedRecommendationIds.length > 0 && selected.length === 0) {
    warnings.push('Aucune recommandation sélectionnée ne correspond au rapport : brief général utilisé.')
  } else if (selected.length === 0) {
    warnings.push('Aucune recommandation sélectionnée : le prompt s’appuie sur le brief général.')
  }

  const lines: string[] = []
  lines.push(`TASK: ${mode === 'faithful' ? 'faithful' : 'premium'} commercial product-design edit of the attached reference image.`)
  lines.push('')
  lines.push(`PRIMARY COMMERCIAL OBJECTIVE: ${brief.primaryCommercialObjective}`)
  lines.push(`ART DIRECTION: ${brief.artDirection}`)

  lines.push('')
  lines.push('MUST CHANGE (modify ONLY these elements):')
  const changes = [...brief.shapesToChange]
  for (const rec of selected) {
    changes.push(`${rec.title}: ${rec.proposedChange}`)
  }
  if (changes.length === 0) changes.push('Apply the art direction above while keeping all other elements identical.')
  for (const c of changes) lines.push(`- ${c}`)
  lines.push(`- Focal point position: ${brief.focalPointPosition}`)
  lines.push(`- Relative proportions: ${brief.relativeProportions}`)
  if (brief.colorPalette.length > 0) lines.push(`- Color palette: ${brief.colorPalette.join(', ')}`)
  if (brief.materialsAndFinishes) lines.push(`- Materials and finishes: ${brief.materialsAndFinishes}`)

  lines.push('')
  lines.push('MUST PRESERVE (do not alter):')
  const preserve = [
    ...brief.elementsToPreserve,
    ...report.preserveElements,
    'the product identity, overall shape, proportions and framing',
    'all existing text, labels, logos and numbers — leave them legible and unchanged unless explicitly listed under MUST CHANGE'
  ]
  if (brandProfile && brandProfile.forbiddenPromises.length > 0) {
    preserve.push(`do not introduce any of these promises: ${brandProfile.forbiddenPromises.join(', ')}`)
  }
  for (const p of preserve) lines.push(`- ${p}`)

  lines.push('')
  lines.push('AVOID:')
  const avoid = [...brief.elementsToAvoid, ...report.avoidElements]
  if (avoid.length === 0) avoid.push('clutter, distorted text, invented logos or symbols, watermarks')
  for (const a of avoid) lines.push(`- ${a}`)

  if (selected.length > 0) {
    lines.push('')
    lines.push('RECOMMENDATION-DRIVEN CHANGES (rationale):')
    for (const rec of selected) {
      lines.push(`- ${rec.title} — observed: ${rec.observedProblem}; change: ${rec.proposedChange} (expected impact: ${rec.expectedImpact}).`)
    }
  }

  lines.push('')
  lines.push(`REALISM / RENDERING: ${brief.expectedRealism}`)
  if (brief.manufacturingConstraints) lines.push(`MANUFACTURING CONSTRAINTS: ${brief.manufacturingConstraints}`)

  lines.push('')
  lines.push('HARD CONSTRAINTS:')
  lines.push('- Modify ONLY the elements listed under MUST CHANGE; keep everything else pixel-faithful.')
  if (mode === 'faithful') {
    lines.push('- Keep the original composition, camera angle, lighting, background and layout unchanged.')
  } else {
    lines.push('- You may refine lighting, background and finish within the brand art direction, but never change the product identity or text.')
  }
  lines.push('- Do not invent new logos, text, symbols, certifications, numbers or claims.')
  lines.push('- Keep the product fully visible and centered; do not crop key elements.')
  lines.push('- Realistic commercial product photography; no photomontage artifacts, no watermark.')

  if (extraInstruction.trim()) {
    lines.push('')
    lines.push(`ADDITIONAL OPERATOR INSTRUCTIONS: ${extraInstruction.trim()}`)
  }

  return { prompt: lines.join('\n'), warnings }
}