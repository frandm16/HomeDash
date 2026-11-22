import { pool } from '../db.js'

const sensitiveKey = /(token|secret|password|authorization|cookie|credential|api[-_]?key)/i

export function redactAuditMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactAuditMetadata)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, sensitiveKey.test(key) ? '[REDACTED]' : redactAuditMetadata(entry)]))
}

export async function recordAudit(input: { userId?: string; action: string; resourceType: string; resourceId?: string; metadata?: Record<string, unknown> }): Promise<void> {
  await pool.query(
    'INSERT INTO audit_events (user_id, action, resource_type, resource_id, metadata) VALUES ($1, $2, $3, $4, $5::jsonb)',
    [input.userId ?? null, input.action, input.resourceType, input.resourceId ?? null, JSON.stringify(redactAuditMetadata(input.metadata ?? {}))],
  )
}
