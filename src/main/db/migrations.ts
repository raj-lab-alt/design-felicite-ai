/**
 * Migrations versionnées de la base SQLite locale.
 * Chaque migration est appliquée dans une transaction et enregistrée dans la table meta.
 * Ne jamais modifier une migration déjà publiée : en ajouter une nouvelle.
 */

export interface Migration {
  version: number
  name: string
  statements: string[]
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    statements: [
      `CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS protocol_versions (
        version TEXT PRIMARY KEY,
        system_prompt_hash TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS brand_profiles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        brand_profile_id TEXT REFERENCES brand_profiles(id) ON DELETE SET NULL,
        favorite INTEGER NOT NULL DEFAULT 0,
        archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS images (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        size_bytes INTEGER NOT NULL,
        sha256 TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'original',
        created_at TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS analyses (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        image_id TEXT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
        status TEXT NOT NULL,
        model TEXT NOT NULL,
        provider TEXT NOT NULL,
        protocol_version TEXT NOT NULL,
        context_json TEXT NOT NULL DEFAULT '{}',
        brand_profile_id TEXT REFERENCES brand_profiles(id) ON DELETE SET NULL,
        error_code TEXT,
        product_summary TEXT,
        felicity_index REAL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS analysis_results (
        analysis_id TEXT PRIMARY KEY REFERENCES analyses(id) ON DELETE CASCADE,
        report_json TEXT NOT NULL,
        report_schema_version TEXT NOT NULL,
        usage_json TEXT,
        created_at TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS recommendations (
        analysis_id TEXT NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
        rec_id TEXT NOT NULL,
        priority INTEGER NOT NULL DEFAULT 1,
        expected_impact TEXT NOT NULL DEFAULT 'medium',
        selected INTEGER NOT NULL DEFAULT 0,
        data TEXT NOT NULL,
        PRIMARY KEY (analysis_id, rec_id)
      );`,
      `CREATE TABLE IF NOT EXISTS variants (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        analysis_id TEXT REFERENCES analyses(id) ON DELETE SET NULL,
        parent_variant_id TEXT REFERENCES variants(id) ON DELETE SET NULL,
        source_image_id TEXT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
        image_id TEXT REFERENCES images(id) ON DELETE SET NULL,
        mode TEXT NOT NULL,
        prompt_text TEXT NOT NULL,
        model TEXT NOT NULL,
        status TEXT NOT NULL,
        selected_recommendation_ids TEXT NOT NULL DEFAULT '[]',
        extra_instruction TEXT NOT NULL DEFAULT '',
        params_json TEXT,
        error_code TEXT,
        created_at TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS experiments (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        hypothesis TEXT NOT NULL DEFAULT '',
        variant_a_id TEXT REFERENCES variants(id) ON DELETE SET NULL,
        variant_b_id TEXT REFERENCES variants(id) ON DELETE SET NULL,
        audience TEXT NOT NULL DEFAULT '',
        channel TEXT NOT NULL DEFAULT '',
        primary_metric TEXT NOT NULL DEFAULT 'ctr',
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS experiment_results (
        id TEXT PRIMARY KEY,
        experiment_id TEXT NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
        variant TEXT NOT NULL,
        metric TEXT NOT NULL,
        value REAL NOT NULL,
        sample_size INTEGER,
        source TEXT NOT NULL DEFAULT 'manuel',
        note TEXT NOT NULL DEFAULT '',
        recorded_at TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS exports (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        analysis_id TEXT NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
        format TEXT NOT NULL,
        file_path TEXT NOT NULL,
        created_at TEXT NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS idx_projects_updated ON projects(updated_at DESC);`,
      `CREATE INDEX IF NOT EXISTS idx_projects_archived ON projects(archived);`,
      `CREATE INDEX IF NOT EXISTS idx_images_project ON images(project_id);`,
      `CREATE INDEX IF NOT EXISTS idx_analyses_project ON analyses(project_id, created_at DESC);`,
      `CREATE INDEX IF NOT EXISTS idx_recommendations_analysis ON recommendations(analysis_id);`,
      `CREATE INDEX IF NOT EXISTS idx_variants_project ON variants(project_id, created_at DESC);`,
      `CREATE INDEX IF NOT EXISTS idx_variants_analysis ON variants(analysis_id);`,
      `CREATE INDEX IF NOT EXISTS idx_experiments_project ON experiments(project_id);`,
      `CREATE INDEX IF NOT EXISTS idx_experiment_results ON experiment_results(experiment_id);`,
      `CREATE INDEX IF NOT EXISTS idx_exports_project ON exports(project_id);`
    ]
  }
]
