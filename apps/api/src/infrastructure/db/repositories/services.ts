import { pool } from '../../../db.js'

export type ServiceInput = { name: string; description?: string; url: string; host?: string; healthcheckUrl?: string; isEnabled?: boolean; sortOrder?: number }
const select = `id, name, description, url, host, healthcheck_url AS "healthcheckUrl", is_enabled AS "isEnabled", sort_order AS "sortOrder", created_at AS "createdAt", updated_at AS "updatedAt"`

export async function listServices() { return (await pool.query(`SELECT ${select} FROM service_catalog WHERE is_enabled = TRUE ORDER BY sort_order, name`)).rows }
export async function listAllServices() { return (await pool.query(`SELECT ${select} FROM service_catalog ORDER BY sort_order, name`)).rows }
export async function createService(input: ServiceInput) {
  return (await pool.query(`INSERT INTO service_catalog (name, description, url, host, healthcheck_url, is_enabled, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING ${select}`, [input.name, input.description ?? '', input.url, input.host ?? null, input.healthcheckUrl ?? null, input.isEnabled ?? true, input.sortOrder ?? 0])).rows[0]
}
export async function updateService(id: string, input: Partial<ServiceInput>) {
  return (await pool.query(`UPDATE service_catalog SET name=COALESCE($2,name), description=COALESCE($3,description), url=COALESCE($4,url), host=COALESCE($5,host), healthcheck_url=COALESCE($6,healthcheck_url), is_enabled=COALESCE($7,is_enabled), sort_order=COALESCE($8,sort_order), updated_at=NOW() WHERE id=$1 RETURNING ${select}`, [id, input.name ?? null, input.description ?? null, input.url ?? null, input.host ?? null, input.healthcheckUrl ?? null, input.isEnabled ?? null, input.sortOrder ?? null])).rows[0]
}
export async function deleteService(id: string) { return (await pool.query('DELETE FROM service_catalog WHERE id=$1', [id])).rowCount === 1 }
