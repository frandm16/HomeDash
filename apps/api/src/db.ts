import pg from 'pg'
import { config } from './config.js'

const { Pool } = pg

export const pool = new Pool({
  connectionString: config.databaseUrl,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30_000,
  max: 10,
})

export async function migrate(): Promise<void> {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      token_hash TEXT NOT NULL UNIQUE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      csrf_token_hash TEXT NOT NULL
    );
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS csrf_token_hash TEXT;
    UPDATE sessions SET csrf_token_hash = encode(digest(csrf_token, 'sha256'), 'hex') WHERE csrf_token_hash IS NULL AND csrf_token IS NOT NULL;
    UPDATE sessions SET csrf_token_hash = encode(gen_random_bytes(32), 'hex') WHERE csrf_token_hash IS NULL;
    ALTER TABLE sessions ALTER COLUMN csrf_token_hash SET NOT NULL;
    ALTER TABLE sessions DROP COLUMN IF EXISTS csrf_token;
    CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);
  `)
}

export async function closeDatabase(): Promise<void> {
  await pool.end()
}
