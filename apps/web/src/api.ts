export type ServiceStatus = 'online' | 'degraded' | 'offline' | 'unknown'
export type Service = { name: string; description: string; url: string; status: ServiceStatus; host: string }
export type DashboardNotification = { id: string; source: string; title: string; body: string; level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'; url?: string; read: boolean; createdAt: string }
export type DashboardSnapshot = { services: Service[]; notifications: DashboardNotification[]; unreadNotifications: number; generatedAt: string; sourceStates?: Record<string, 'ready' | 'offline' | 'stale' | 'not_configured'> }
export type Widget = { id: string; widgetType: string; widgetVersion: number; configuration: Record<string, unknown>; layout: Record<string, unknown>; isEnabled: boolean }
export type DashboardProfile = { id: string; dashboardId?: string; profileKey: 'desktop' | 'wall' | 'mobile'; layoutVersion: number }
export type Bookmark = { id: string; name: string; url: string; icon?: string; category?: string; sortOrder: number }
export type AuthUser = { id: string; username: string }
let csrfToken: string | undefined

export function setCsrfToken(token?: string): void { csrfToken = token }

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...init?.headers as Record<string, string> }
  if (csrfToken && init?.method && init.method !== 'GET') headers['X-CSRF-Token'] = csrfToken
  const response = await fetch(`${apiBaseUrl}${path}`, { ...init, credentials: 'include', headers })
  if (!response.ok) throw new Error(`API returned ${response.status}`)
  return response.json() as Promise<T>
}

export function getSession(): Promise<{ user: AuthUser; expiresAt: string; csrfToken: string }> {
  return request<{ user: AuthUser; expiresAt: string; csrfToken: string }>('/v1/auth/session').then((result) => { setCsrfToken(result.csrfToken); return result })
}
export function login(username: string, password: string): Promise<{ user: AuthUser; csrfToken: string }> {
  return request<{ user: AuthUser; csrfToken: string }>('/v1/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }).then((result) => { setCsrfToken(result.csrfToken); return result })
}
export function logout(): Promise<{ ok: boolean }> { return request<{ ok: boolean }>('/v1/auth/logout', { method: 'POST' }).finally(() => setCsrfToken(undefined)) }
export function fetchDashboard(signal?: AbortSignal): Promise<DashboardSnapshot> { return request('/v1/dashboard', { signal }) }
export function fetchProfiles(): Promise<{ profiles: DashboardProfile[] }> { return request('/v1/profiles') }
export function fetchWidgets(profileId: string): Promise<{ widgets: Widget[] }> { return request(`/v1/profiles/${profileId}/widgets`) }
export function fetchBookmarks(profileId: string): Promise<{ bookmarks: Bookmark[] }> { return request(`/v1/profiles/${profileId}/bookmarks`) }
export function createBookmark(profileId: string, input: Omit<Bookmark, 'id' | 'sortOrder'>): Promise<Bookmark> { return request(`/v1/profiles/${profileId}/bookmarks`, { method: 'POST', body: JSON.stringify(input) }) }
export function openEvents(onEvent: (event: MessageEvent) => void): EventSource { const source = new EventSource(`${apiBaseUrl}/v1/events`, { withCredentials: true }); source.onmessage = onEvent; return source }
