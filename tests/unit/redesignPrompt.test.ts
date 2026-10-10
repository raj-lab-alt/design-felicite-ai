import { describe, expect, it } from 'vitest'
import { buildRedesignPrompt } from '@main/services/RedesignPromptBuilder'
import { makeReport } from '../fixtures/report'

describe('buildRedesignPrompt', () => {
  it('construit un prompt fidèle complet et préservateur', () => {
    const report = makeReport()
    const result = buildRedesignPrompt({
      report,
      mode: 'faithful',
      selectedRecommendationIds: ['rec-1'],
      extraInstruction: '',
      brandProfile: null
    })
    expect(result.prompt).toContain('TASK: faithful')
    expect(result.prompt).toContain('MUST CHANGE')
    expect(result.prompt).toContain('MUST PRESERVE')
    expect(result.prompt).toContain('the product identity, overall shape, proportions and framing')
    expect(result.prompt).toContain('HARD CONSTRAINTS')
    expect(result.prompt).toContain('Rendre le prix visible') // recommandation sélectionnée
    expect(result.warnings).toEqual([])
  })

  it('avertit quand une recommandation sélectionnée est inconnue du rapport', () => {
    const result = buildRedesignPrompt({
      report: makeReport(),
      mode: 'premium',
      selectedRecommendationIds: ['id-inconnu'],
      extraInstruction: '',
      brandProfile: null
    })
    expect(result.warnings.some((w) => w.includes('ne correspond au rapport'))).toBe(true)
  })

  it('ajoute des consignes supplémentaires si présentes', () => {
    const result = buildRedesignPrompt({
      report: makeReport(),
      mode: 'faithful',
      selectedRecommendationIds: [],
      extraInstruction: '  Garder la lumière rasante.  ',
      brandProfile: null
    })
    expect(result.prompt).toContain('ADDITIONAL OPERATOR INSTRUCTIONS: Garder la lumière rasante.')
  })

  it('intègre les promesses interdites du profil de marque', () => {
    const report = makeReport()
    const result = buildRedesignPrompt({
      report,
      mode: 'faithful',
      selectedRecommendationIds: [],
      extraInstruction: '',
      brandProfile: {
        name: 'Marque',
        forbiddenPromises: ['Garantie à vie'],
        description: '',
        sector: '',
        market: '',
        audience: '',
        positioning: '',
        visualTone: '',
        recommendedPalette: [],
        colorsToAvoid: [],
        qualityType: '',
        priceRange: '',
        manufacturingConstraints: '',
        brandValues: [],
        allowedPromises: [],
        visualReferences: [],
        photoStyle: '',
        competitivePositioning: '',
        id: 'bp-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    })
    expect(result.prompt).toContain('do not introduce any of these promises: Garantie à vie')
  })

  it('mode premium autorise des raffinements tout en bloquant la dénaturation', () => {
    const result = buildRedesignPrompt({
      report: makeReport(),
      mode: 'premium',
      selectedRecommendationIds: [],
      extraInstruction: '',
      brandProfile: null
    })
    expect(result.prompt).toContain('You may refine lighting, background and finish within the brand art direction')
    expect(result.prompt).toContain('Do not invent new logos, text, symbols, certifications, numbers or claims.')
  })
})