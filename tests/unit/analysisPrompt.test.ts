import { describe, expect, it } from 'vitest'
import {
  buildAnalysisInstruction,
  buildRepairSuffix,
  extractJson
} from '@main/services/analysisPrompt'
import type { AnalysisContext, BrandProfile } from '@shared/schemas'

describe('buildAnalysisInstruction', () => {
  it('inclut les éléments de contexte fournis et ignore les vides', () => {
    const context: AnalysisContext = {
      productName: 'Collier sérénité',
      categoryId: 'bijou',
      price: '49 €',
      objective: 'vente'
    }
    const instruction = buildAnalysisInstruction(context, null)
    expect(instruction).toContain('Produit : Collier sérénité')
    expect(instruction).toContain('Catégorie : Bijou')
    expect(instruction).toContain('Prix indicatif : 49 €')
    expect(instruction).toContain('Objectif : vente')
    expect(instruction).not.toContain('Audience cible :')
    expect(instruction).toContain('Consignes : analysez l’image jointe')
  })

  it('ajoute le profil de marque uniquement si transmis', () => {
    const context: AnalysisContext = {}
    const profile: BrandProfile = {
      name: 'Félicité',
      sector: 'Bijouterie',
      visualTone: 'chaleureux',
      description: '',
      market: '',
      audience: '',
      positioning: '',
      recommendedPalette: [],
      colorsToAvoid: [],
      qualityType: '',
      priceRange: '',
      manufacturingConstraints: '',
      brandValues: [],
      allowedPromises: [],
      forbiddenPromises: [],
      visualReferences: [],
      photoStyle: '',
      competitivePositioning: '',
      id: 'bp-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    const base = buildAnalysisInstruction(context, null)
    const withProfile = buildAnalysisInstruction(context, profile)
    expect(base).not.toContain('Profil de marque à respecter')
    expect(withProfile).toContain('Profil de marque à respecter')
    expect(withProfile).toContain('Secteur : Bijouterie')
    expect(withProfile).toContain('Ton visuel : chaleureux')
  })
})

describe('extractJson', () => {
  it('extrait un objet JSON brut', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 })
  })

  it('extrait un objet JSON entouré d’un bloc markdown', () => {
    const text = '```json\n{"scores":[{"value":80}]}\n```'
    expect(extractJson(text)).toEqual({ scores: [{ value: 80 }] })
  })

  it('supporte un bloc markdown sans mention json', () => {
    expect(extractJson('```\n{"x":true}\n```')).toEqual({ x: true })
  })

  it('lève une exception sur du JSON invalide', () => {
    expect(() => extractJson('pas du json')).toThrow()
  })
})

describe('buildRepairSuffix', () => {
  it('liste les erreurs transmises', () => {
    const suffix = buildRepairSuffix(['erreur 1', 'erreur 2'])
    expect(suffix).toContain('- erreur 1')
    expect(suffix).toContain('- erreur 2')
    expect(suffix).toContain('objet JSON strictement conforme')
  })
})