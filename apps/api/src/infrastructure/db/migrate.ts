import type { PoolClient } from 'pg'
import { pool } from '../../db.js'
import { name as initialName, up as initialUp, version as initialVersion } from './migrations/001_initial.js'
import { name as serviceCatalogName, up as serviceCatalogUp, version as serviceCatalogVersion } from './migrations/002_service_catalog_admin.js'

type Migration = { version: number; name: string; up: string }
const migrations: Migration[] = [
  { version: initialVersion, name: initialName, up: initialUp },
  { version: serviceCatalogVersion, name: serviceCatalogName, up: serviceCatalogUp },
].sort((left, right) => left.version - right.version)
if (new Set(migrations.map((migration) => migration.version)).size !== migrations.length) throw new Error('Duplicate migration version')

async function ensureLedger(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

export async function migrate(): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query('SELECT pg_advisory_lock($1)', [98172341])
    await ensureLedger(client)
    const applied = await client.query<{ version: number; name: string }>('SELECT version, name FROM schema_migrations ORDER BY version')
    const appliedVersions = new Set(applied.rows.map((row) => row.version))
    const knownVersions = new Set(migrations.map((migration) => migration.version))
    const unknown = applied.rows.find((row) => !knownVersions.has(row.version))
    if (unknown) throw new Error(`Unknown database migration version: ${unknown.version}`)

    for (const migration of migrations) {
      if (appliedVersions.has(migration.version)) continue
      await client.query('BEGIN')
      try {
        await client.query(migration.up)
        await client.query('INSERT INTO schema_migrations (version, name) VALUES ($1, $2)', [migration.version, migration.name])
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [98172341]).catch(() => undefined)
    client.release()
  }
}
