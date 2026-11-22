export type ServiceStatus = 'online' | 'degraded' | 'offline' | 'unknown'
export type Service = { name: string; description: string; url: string; status: ServiceStatus; host: string }
export type DashboardNotification = { id: string; source: string; title: string; body: string; level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'; url?: string; read: boolean; createdAt: string }
export type DashboardSnapshot = { services: Service[]; notifications: DashboardNotification[]; unreadNotifications: number; generatedAt: string }
export type AuthUser = { id: string; username: string }

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...init?.headers } })
  if (!response.ok) throw new Error(`API returned ${response.status}`)
  return response.json() as Promise<T>
}

export function getSession(): Promise<{ user: AuthUser; expiresAt: string }> { return request('/v1/auth/session') }
export function login(username: string, password: string): Promise<{ user: AuthUser }> { return request('/v1/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }) }
export function logout(): Promise<{ ok: boolean }> { return request('/v1/auth/logout', { method: 'POST' }) }
export function fetchDashboard(signal?: AbortSignal): Promise<DashboardSnapshot> { return request('/v1/dashboard', { signal }) }
