import { pool } from '../../../db.js'

export type ProfileKey = 'desktop' | 'wall' | 'mobile'

type DashboardInput = { name: string }
type WidgetInput = { widgetType: string; widgetVersion?: number; configuration?: unknown; layout?: unknown; isEnabled?: boolean }
type BookmarkInput = { name: string; url: string; icon?: string; category?: string; sortOrder?: number }

const profileKeys: ProfileKey[] = ['desktop', 'wall', 'mobile']

export async function ensureDashboard(userId: string): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO dashboards (user_id, name, is_default) VALUES ($1, 'HomeDash', TRUE)
     ON CONFLICT (user_id, name) DO UPDATE SET updated_at = NOW() RETURNING id`, [userId],
  )
  const dashboardId = result.rows[0]?.id ?? (await pool.query<{ id: string }>('SELECT id FROM dashboards WHERE user_id = $1 AND is_default = TRUE', [userId])).rows[0]?.id
  if (!dashboardId) throw new Error('Unable to create dashboard')
  await pool.query(`INSERT INTO dashboard_profiles (dashboard_id, profile_key) VALUES ${profileKeys.map((_, i) => `($1, $${i + 2})`).join(', ')} ON CONFLICT DO NOTHING`, [dashboardId, ...profileKeys])
  return dashboardId
}

export async function listDashboards(userId: string) {
  return (await pool.query(`SELECT id, name, is_default AS "isDefault", created_at AS "createdAt", updated_at AS "updatedAt" FROM dashboards WHERE user_id = $1 ORDER BY is_default DESC, name`, [userId])).rows
}

export async function createDashboard(userId: string, input: DashboardInput) {
  const result = await pool.query(`INSERT INTO dashboards (user_id, name, is_default) VALUES ($1, $2, NOT EXISTS (SELECT 1 FROM dashboards WHERE user_id = $1)) RETURNING id, name, is_default AS "isDefault", created_at AS "createdAt", updated_at AS "updatedAt"`, [userId, input.name])
  const dashboard = result.rows[0]
  if (dashboard) await pool.query(`INSERT INTO dashboard_profiles (dashboard_id, profile_key) SELECT $1, unnest($2::text[])`, [dashboard.id, profileKeys])
  return dashboard
}

export async function updateDashboard(userId: string, id: string, input: DashboardInput) {
  return (await pool.query(`UPDATE dashboards SET name = $3, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING id, name, is_default AS "isDefault", created_at AS "createdAt", updated_at AS "updatedAt"`, [id, userId, input.name])).rows[0]
}

export async function deleteDashboard(userId: string, id: string): Promise<boolean> {
  const count = await pool.query<{ count: string }>('SELECT count(*) FROM dashboards WHERE user_id = $1', [userId])
  if (Number(count.rows[0]?.count) <= 1) return false
  const result = await pool.query('DELETE FROM dashboards WHERE id = $1 AND user_id = $2', [id, userId])
  return result.rowCount === 1
}

export async function listProfiles(userId: string, dashboardId?: string) {
  const id = dashboardId ?? await ensureDashboard(userId)
  return (await pool.query(`SELECT p.id, p.dashboard_id AS "dashboardId", p.profile_key AS "profileKey", p.layout_version AS "layoutVersion", p.created_at AS "createdAt", p.updated_at AS "updatedAt" FROM dashboard_profiles p JOIN dashboards d ON d.id = p.dashboard_id WHERE d.user_id = $1 AND d.id = $2 ORDER BY p.profile_key`, [userId, id])).rows
}

export async function updateProfile(userId: string, profileId: string, input: { layoutVersion?: number }) {
  return (await pool.query(`UPDATE dashboard_profiles p SET layout_version = COALESCE($3, p.layout_version + 1), updated_at = NOW() FROM dashboards d WHERE p.id = $1 AND p.dashboard_id = d.id AND d.user_id = $2 RETURNING p.id, p.profile_key AS "profileKey", p.layout_version AS "layoutVersion", p.updated_at AS "updatedAt"`, [profileId, userId, input.layoutVersion ?? null])).rows[0]
}

export async function listWidgets(userId: string, profileId: string) {
  return (await pool.query(`SELECT w.id, w.widget_type AS "widgetType", w.widget_version AS "widgetVersion", w.configuration, w.layout, w.is_enabled AS "isEnabled", w.created_at AS "createdAt", w.updated_at AS "updatedAt" FROM widget_instances w JOIN dashboard_profiles p ON p.id = w.profile_id JOIN dashboards d ON d.id = p.dashboard_id WHERE w.profile_id = $1 AND d.user_id = $2 ORDER BY w.created_at`, [profileId, userId])).rows
}

export async function createWidget(userId: string, profileId: string, input: WidgetInput) {
  const result = await pool.query(`INSERT INTO widget_instances (profile_id, widget_type, widget_version, configuration, layout, is_enabled) SELECT $1, $2, $3, $4::jsonb, $5::jsonb, $6 WHERE EXISTS (SELECT 1 FROM dashboard_profiles p JOIN dashboards d ON d.id = p.dashboard_id WHERE p.id = $1 AND d.user_id = $7) RETURNING id, widget_type AS "widgetType", widget_version AS "widgetVersion", configuration, layout, is_enabled AS "isEnabled", updated_at AS "updatedAt"`, [profileId, input.widgetType, input.widgetVersion ?? 1, JSON.stringify(input.configuration ?? {}), JSON.stringify(input.layout ?? {}), input.isEnabled ?? true, userId])
  return result.rows[0]
}

export async function updateWidget(userId: string, widgetId: string, input: Partial<WidgetInput>, expectedUpdatedAt?: string) {
  const result = await pool.query(`UPDATE widget_instances w SET configuration = COALESCE($3::jsonb, w.configuration), layout = COALESCE($4::jsonb, w.layout), is_enabled = COALESCE($5, w.is_enabled), updated_at = NOW() FROM dashboard_profiles p, dashboards d WHERE w.id = $1 AND w.profile_id = p.id AND p.dashboard_id = d.id AND d.user_id = $2 AND ($6::timestamptz IS NULL OR w.updated_at = $6::timestamptz) RETURNING w.id, w.widget_type AS "widgetType", w.widget_version AS "widgetVersion", w.configuration, w.layout, w.is_enabled AS "isEnabled", w.updated_at AS "updatedAt"`, [widgetId, userId, input.configuration == null ? null : JSON.stringify(input.configuration), input.layout == null ? null : JSON.stringify(input.layout), input.isEnabled ?? null, expectedUpdatedAt ?? null])
  return result.rows[0]
}

export async function deleteWidget(userId: string, widgetId: string): Promise<boolean> {
  const result = await pool.query(`DELETE FROM widget_instances w USING dashboard_profiles p, dashboards d WHERE w.id = $1 AND w.profile_id = p.id AND p.dashboard_id = d.id AND d.user_id = $2`, [widgetId, userId])
  return result.rowCount === 1
}

export async function listBookmarks(userId: string, profileId: string) {
  return (await pool.query(`SELECT b.id, b.name, b.url, b.icon, b.category, b.sort_order AS "sortOrder", b.created_at AS "createdAt", b.updated_at AS "updatedAt" FROM bookmarks b JOIN dashboard_profiles p ON p.id = b.profile_id JOIN dashboards d ON d.id = p.dashboard_id WHERE b.profile_id = $1 AND d.user_id = $2 ORDER BY b.sort_order, b.created_at`, [profileId, userId])).rows
}

export async function createBookmark(userId: string, profileId: string, input: BookmarkInput) {
  const result = await pool.query(`INSERT INTO bookmarks (profile_id, name, url, icon, category, sort_order) SELECT $1, $2, $3, $4, $5, $6 WHERE EXISTS (SELECT 1 FROM dashboard_profiles p JOIN dashboards d ON d.id = p.dashboard_id WHERE p.id = $1 AND d.user_id = $7) RETURNING id, name, url, icon, category, sort_order AS "sortOrder"`, [profileId, input.name, input.url, input.icon ?? null, input.category ?? null, input.sortOrder ?? 0, userId])
  return result.rows[0]
}

export async function updateBookmark(userId: string, id: string, input: Partial<BookmarkInput>) {
  return (await pool.query(`UPDATE bookmarks b SET name = COALESCE($3, b.name), url = COALESCE($4, b.url), icon = COALESCE($5, b.icon), category = COALESCE($6, b.category), sort_order = COALESCE($7, b.sort_order), updated_at = NOW() FROM dashboard_profiles p, dashboards d WHERE b.id = $1 AND b.profile_id = p.id AND p.dashboard_id = d.id AND d.user_id = $2 RETURNING b.id, b.name, b.url, b.icon, b.category, b.sort_order AS "sortOrder", b.updated_at AS "updatedAt"`, [id, userId, input.name ?? null, input.url ?? null, input.icon ?? null, input.category ?? null, input.sortOrder ?? null])).rows[0]
}

export async function deleteBookmark(userId: string, id: string): Promise<boolean> {
  const result = await pool.query(`DELETE FROM bookmarks b USING dashboard_profiles p, dashboards d WHERE b.id = $1 AND b.profile_id = p.id AND p.dashboard_id = d.id AND d.user_id = $2`, [id, userId])
  return result.rowCount === 1
}
