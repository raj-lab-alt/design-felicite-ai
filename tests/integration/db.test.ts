import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseService } from '@main/db/DatabaseService'
import { ProjectService } from '@main/services/ProjectService'
import { ExperimentService } from '@main/services/ExperimentService'

let dir: string
let db: DatabaseService
let projects: ProjectService
let experiments: ExperimentService

beforeAll(() => {
  // node-sqlite3-wasm : aucune dépendance native, un simple dossier temporaire suffit.
  dir = mkdtempSync(join(tmpdir(), 'design-felicite-test-'))
  const dbPath = join(dir, 'test.db')
  db = new DatabaseService(dbPath)
  db.open()
  projects = new ProjectService(db)
  experiments = new ExperimentService(db)
})

afterAll(() => {
  db.close()
  rmSync(dir, { recursive: true, force: true })
})

describe('Base de données et services (intégration)', () => {
  it('applique les migrations et expose un schéma à jour', () => {
    expect(db.getSchemaVersion()).toBeGreaterThan(0)
    expect(db.integrityCheck()).toBe('ok')
  })

  it('crée, liste, met à jour et supprime un projet', () => {
    const created = projects.create({ name: 'Bougies 2026' })
    expect(created.id).toMatch(/^proj/)
    expect(created.favorite).toBe(false)
    expect(created.imageCount).toBe(0)

    expect(projects.get(created.id).name).toBe('Bougies 2026')
    expect(projects.list().some((p) => p.id === created.id)).toBe(true)
    expect(projects.search('bougies').some((p) => p.id === created.id)).toBe(true)
    expect(projects.search('riens').some((p) => p.id === created.id)).toBe(false)

    const fav = projects.update({ id: created.id, favorite: true })
    expect(fav.favorite).toBe(true)

    projects.delete(created.id)
    expect(() => projects.get(created.id)).toThrow()

    return created
  })

  it('devient honnête sans assez de données d’expérience', () => {
    const project = projects.create({ name: 'Expérimentations' })
    const experiment = experiments.create({
      projectId: project.id,
      name: 'Test A/B packaging',
      hypothesis: 'Un packaging plus épuré convertit mieux.',
      primaryMetric: 'ctr',
      variantAId: null,
      variantBId: null,
      audience: 'Femmes 25-44',
      channel: 'Meta Ads',
      notes: ''
    })

    const summaryEmpty = experiments.summary(experiment.id)
    expect(summaryEmpty.verdict).toBe('insufficient_data')

    for (let i = 0; i < 25; i++) {
      experiments.addResult(experiment.id, { variant: 'A', metric: 'ctr', value: 10, sampleSize: null, source: 'manual', note: '' })
      experiments.addResult(experiment.id, { variant: 'B', metric: 'ctr', value: 8, sampleSize: null, source: 'manual', note: '' })
    }

    const summary = experiments.summary(experiment.id)
    expect(summary.verdict).toBe('variant_a')
    expect(summary.perVariant.find((v) => v.variant === 'A')?.average).toBeCloseTo(10)
    expect(summary.perVariant.find((v) => v.variant === 'B')?.average).toBeCloseTo(8)
    expect(experiments.results(experiment.id)).toHaveLength(50)
  })
})