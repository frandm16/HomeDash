import { pool } from '../../../db.js'

export type ProfileKey = 'desktop' | 'wall' | 'mobile'

export async function ensureDashboard(userId: string) {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO dashboards (user_id, name, is_default) VALUES ($1, 'HomeDash', TRUE)
     ON CONFLICT (user_id, name) DO UPDATE SET updated_at = NOW()
     RETURNING id`, [userId],
  )
  const dashboardId = result.rows[0]?.id ?? (await pool.query<{ id: string }>('SELECT id FROM dashboards WHERE user_id = $1 AND is_default = TRUE', [userId])).rows[0]?.id
  if (!dashboardId) throw new Error('Unable to create dashboard')
  await pool.query(
    `INSERT INTO dashboard_profiles (dashboard_id, profile_key)
     VALUES ${(['desktop', 'wall', 'mobile'] as ProfileKey[]).map((_, i) => `($1, $${i + 2})`).join(', ')}
     ON CONFLICT (dashboard_id, profile_key) DO NOTHING`, [dashboardId, 'desktop', 'wall', 'mobile'],
  )
  return dashboardId
}

export async function listProfiles(userId: string) {
  await ensureDashboard(userId)
  return (await pool.query(
    `SELECT p.id, p.profile_key AS "profileKey", p.layout_version AS "layoutVersion", p.created_at AS "createdAt", p.updated_at AS "updatedAt"
     FROM dashboard_profiles p JOIN dashboards d ON d.id = p.dashboard_id
     WHERE d.user_id = $1 ORDER BY p.profile_key`, [userId],
  )).rows
}

export async function listWidgets(userId: string, profileId: string) {
  return (await pool.query(
    `SELECT w.id, w.widget_type AS "widgetType", w.widget_version AS "widgetVersion", w.configuration, w.layout, w.is_enabled AS "isEnabled", w.created_at AS "createdAt", w.updated_at AS "updatedAt"
     FROM widget_instances w JOIN dashboard_profiles p ON p.id = w.profile_id JOIN dashboards d ON d.id = p.dashboard_id
     WHERE w.profile_id = $1 AND d.user_id = $2 ORDER BY w.created_at`, [profileId, userId],
  )).rows
}

export async function createWidget(userId: string, profileId: string, input: { widgetType: string; configuration?: unknown; layout?: unknown }) {
  const result = await pool.query(
    `INSERT INTO widget_instances (profile_id, widget_type, configuration, layout)
     SELECT $1, $2, $3::jsonb, $4::jsonb WHERE EXISTS (
       SELECT 1 FROM dashboard_profiles p JOIN dashboards d ON d.id = p.dashboard_id WHERE p.id = $1 AND d.user_id = $5)
     RETURNING id, widget_type AS "widgetType", widget_version AS "widgetVersion", configuration, layout, is_enabled AS "isEnabled"`,
    [profileId, input.widgetType, JSON.stringify(input.configuration ?? {}), JSON.stringify(input.layout ?? {}), userId],
  )
  if (!result.rows[0]) throw new Error('Profile not found')
  return result.rows[0]
}

export async function deleteWidget(userId: string, widgetId: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM widget_instances w USING dashboard_profiles p, dashboards d
     WHERE w.id = $1 AND w.profile_id = p.id AND p.dashboard_id = d.id AND d.user_id = $2`, [widgetId, userId],
  )
  return result.rowCount === 1
}

export async function listBookmarks(userId: string, profileId: string) {
  return (await pool.query(
    `SELECT b.id, b.name, b.url, b.icon, b.category, b.sort_order AS "sortOrder", b.created_at AS "createdAt", b.updated_at AS "updatedAt"
     FROM bookmarks b JOIN dashboard_profiles p ON p.id = b.profile_id JOIN dashboards d ON d.id = p.dashboard_id
     WHERE b.profile_id = $1 AND d.user_id = $2 ORDER BY b.sort_order, b.created_at`, [profileId, userId],
  )).rows
}

export async function createBookmark(userId: string, profileId: string, input: { name: string; url: string; icon?: string; category?: string }) {
  const result = await pool.query(
    `INSERT INTO bookmarks (profile_id, name, url, icon, category)
     SELECT $1, $2, $3, $4, $5 WHERE EXISTS (
       SELECT 1 FROM dashboard_profiles p JOIN dashboards d ON d.id = p.dashboard_id WHERE p.id = $1 AND d.user_id = $6)
     RETURNING id, name, url, icon, category, sort_order AS "sortOrder"`, [profileId, input.name, input.url, input.icon ?? null, input.category ?? null, userId],
  )
  if (!result.rows[0]) throw new Error('Profile not found')
  return result.rows[0]
}
