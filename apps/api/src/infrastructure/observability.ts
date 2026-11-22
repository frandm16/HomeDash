import { pool } from '../db.js'

export async function cleanupExpiredSessions(): Promise<number> {
  const result = await pool.query('DELETE FROM sessions WHERE expires_at < NOW() OR revoked_at < NOW() - INTERVAL \'30 days\'')
  return result.rowCount ?? 0
}
