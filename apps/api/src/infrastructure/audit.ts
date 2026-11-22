import { pool } from '../db.js'

export async function recordAudit(input: { userId?: string; action: string; resourceType: string; resourceId?: string; metadata?: Record<string, unknown> }): Promise<void> {
  await pool.query(
    'INSERT INTO audit_events (user_id, action, resource_type, resource_id, metadata) VALUES ($1, $2, $3, $4, $5::jsonb)',
    [input.userId ?? null, input.action, input.resourceType, input.resourceId ?? null, JSON.stringify(input.metadata ?? {})],
  )
}
