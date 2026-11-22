import assert from 'node:assert/strict'
import test from 'node:test'
import { pool } from './db.js'
import { cleanupExpiredSessions } from './infrastructure/observability.js'

const databaseUrl = process.env.DATABASE_URL

test('database integration can be enabled explicitly', async (t) => {
  if (!databaseUrl || process.env.RUN_DB_TESTS !== '1') {
    t.skip('Set RUN_DB_TESTS=1 and DATABASE_URL to run PostgreSQL integration tests')
    return
  }
  const result = await pool.query<{ ok: number }>('SELECT 1 AS ok')
  assert.equal(result.rows[0]?.ok, 1)
  assert.ok((await cleanupExpiredSessions()) >= 0)
})
