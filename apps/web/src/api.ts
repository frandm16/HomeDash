export type ServiceStatus = 'online' | 'degraded' | 'offline' | 'unknown'
export type SourceState = 'ready' | 'offline' | 'stale' | 'not_configured'
export type Service = { id?: string; name: string; description: string; url: string; status: ServiceStatus; host: string }
export type DashboardNotification = { id: string; source: string; title: string; body: string; level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'; url?: string; read: boolean; createdAt: string }
export type PerformanceMetric = { key: 'cpu' | 'gpu' | 'ram' | 'storage' | 'network'; label: string; value: number | null; unit: string; state: 'ready' | 'empty' | 'offline' | 'stale' | 'not_configured'; detail?: string }
export type MetricHistoryPoint = { timestamp: string; cpu: number | null; ram: number | null; gpu: number | null }
export type PerformanceSnapshot = { metrics: PerformanceMetric[]; generatedAt: string; sourceState: SourceState; history?: MetricHistoryPoint[] }
export type DashboardSnapshot = { services: Service[]; notifications: DashboardNotification[]; unreadNotifications: number; generatedAt: string; sourceStates?: Record<string, SourceState> }
export type GridLayout = { x: number; y: number; width: number; height: number }
export type Widget = { id: string; widgetType: string; widgetVersion: number; configuration: Record<string, unknown>; layout: GridLayout; isEnabled: boolean; updatedAt?: string }
export type WidgetDefinition = { type: string; version: number; defaultConfiguration: Record<string, unknown>; minSize: { w: number; h: number }; initialSize: { w: number; h: number }; permissions: string[]; refreshIntervalMs?: number }
export type DashboardProfile = { id: string; dashboardId?: string; profileKey: 'desktop' | 'wall' | 'mobile'; layoutVersion: number }
export type Bookmark = { id: string; widgetId?: string | null; name: string; url: string; icon?: string; category?: string; sortOrder: number }
export type AuthUser = { id: string; username: string }
export type WeatherUnits = 'metric' | 'imperial'
export type WeatherHourlyPoint = { time: string; temperature: number; weatherCode: number; precipitationProbability: number | null; humidity: number | null }
export type WeatherSnapshot = {
  latitude: number
  longitude: number
  units: WeatherUnits
  timezone: string
  current: { temperature: number; apparentTemperature: number; humidity: number; dewPoint: number | null; windSpeed: number; weatherCode: number; isDay: boolean }
  daily: { tempMax: number | null; tempMin: number | null; precipitationProbabilityMax: number | null }
  hourly: WeatherHourlyPoint[]
  fetchedAt: string
}
export type WeatherLocationResult = { name: string; country: string; admin1?: string; latitude: number; longitude: number }
export type BootstrapPayload = {
  user: AuthUser
  expiresAt: string
  csrfToken: string
  profile: DashboardProfile | null
  widgets: Widget[]
  bookmarks: Bookmark[]
  snapshot: DashboardSnapshot | null
  performance: PerformanceSnapshot | null
}
export class ApiError extends Error {
  status: number
  constructor(status: number) {
    super(`API returned ${status}`)
    this.status = status
  }
}
let csrfToken: string | undefined
export function setCsrfToken(token?: string): void { csrfToken = token }
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api'
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { ...init?.headers as Record<string, string> }
  if (init?.body !== undefined && !headers['Content-Type']) headers['Content-Type'] = 'application/json'
  if (csrfToken && init?.method && init.method !== 'GET') headers['X-CSRF-Token'] = csrfToken
  const response = await fetch(`${apiBaseUrl}${path}`, { ...init, credentials: 'include', headers })
  if (!response.ok) throw new ApiError(response.status)
  return response.json() as Promise<T>
}
export function fetchBootstrap(profile: 'desktop' | 'wall' | 'mobile' = 'desktop', signal?: AbortSignal): Promise<BootstrapPayload> {
  return request<BootstrapPayload>(`/v1/bootstrap?profile=${profile}`, { signal }).then((result) => {
    setCsrfToken(result.csrfToken)
    return result
  })
}
let initialBootstrapPromise: Promise<BootstrapPayload> | null = null
if (typeof window !== 'undefined') {
  initialBootstrapPromise = fetchBootstrap('desktop')
  initialBootstrapPromise.catch(() => undefined)
}
export function consumeInitialBootstrap(): Promise<BootstrapPayload> {
  if (initialBootstrapPromise) {
    const pending = initialBootstrapPromise
    initialBootstrapPromise = null
    return pending
  }
  return fetchBootstrap('desktop')
}
export function getSession(): Promise<{ user: AuthUser; expiresAt: string; csrfToken: string }> { return request<{ user: AuthUser; expiresAt: string; csrfToken: string }>('/v1/auth/session').then((result) => { setCsrfToken(result.csrfToken); return result }) }
export function login(username: string, password: string): Promise<{ user: AuthUser; csrfToken: string }> { return request<{ user: AuthUser; csrfToken: string }>('/v1/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }).then((result) => { setCsrfToken(result.csrfToken); return result }) }
export function logout(): Promise<{ ok: boolean }> { return request<{ ok: boolean }>('/v1/auth/logout', { method: 'POST' }).finally(() => setCsrfToken(undefined)) }
export function fetchDashboard(signal?: AbortSignal): Promise<DashboardSnapshot> { return request('/v1/dashboard', { signal }) }
export function fetchPerformance(signal?: AbortSignal): Promise<PerformanceSnapshot> { return request('/v1/performance', { signal }) }
export function fetchWeather(lat: number, lon: number, units: WeatherUnits = 'metric', signal?: AbortSignal): Promise<WeatherSnapshot> {
  return request(`/v1/weather?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}&units=${units}`, { signal })
}
export function searchWeatherLocations(query: string, signal?: AbortSignal): Promise<{ locations: WeatherLocationResult[] }> {
  return request(`/v1/weather/locations?q=${encodeURIComponent(query)}`, { signal })
}
export function fetchProfiles(): Promise<{ profiles: DashboardProfile[] }> { return request('/v1/profiles') }
export function fetchWidgetDefinitions(): Promise<{ widgets: WidgetDefinition[] }> { return request('/v1/widgets/definitions') }
export function fetchWidgets(profileId: string): Promise<{ widgets: Widget[] }> { return request(`/v1/profiles/${profileId}/widgets`) }
export function createWidget(profileId: string, widgetType: string, configuration: Record<string, unknown>, layout: GridLayout): Promise<Widget> { return request(`/v1/profiles/${profileId}/widgets`, { method: 'POST', body: JSON.stringify({ widgetType, configuration, layout, isEnabled: true }) }) }
export function deleteWidget(id: string): Promise<{ ok: boolean }> { return request(`/v1/widgets/${id}`, { method: 'DELETE' }) }
export function updateWidget(id: string, patch: { layout?: GridLayout; configuration?: Record<string, unknown>; isEnabled?: boolean }, updatedAt?: string): Promise<Widget> { return request(`/v1/widgets/${id}`, { method: 'PATCH', headers: updatedAt ? { 'If-Unmodified-Since': updatedAt } : undefined, body: JSON.stringify(patch) }) }
export function fetchBookmarks(profileId: string): Promise<{ bookmarks: Bookmark[] }> { return request(`/v1/profiles/${profileId}/bookmarks`) }
export function createBookmark(profileId: string, input: Omit<Bookmark, 'id' | 'sortOrder'> & { sortOrder?: number }): Promise<Bookmark> { return request(`/v1/profiles/${profileId}/bookmarks`, { method: 'POST', body: JSON.stringify(input) }) }
export function updateBookmark(id: string, input: Partial<Omit<Bookmark, 'id'>>): Promise<Bookmark> { return request(`/v1/bookmarks/${id}`, { method: 'PATCH', body: JSON.stringify(input) }) }
export function deleteBookmark(id: string): Promise<{ ok: boolean }> { return request(`/v1/bookmarks/${id}`, { method: 'DELETE' }) }
export function openEvents(onEvent: (event: MessageEvent) => void, onState?: (state: 'connected' | 'reconnecting' | 'offline') => void): EventSource { const source = new EventSource(`${apiBaseUrl}/v1/events`, { withCredentials: true }); source.onopen = () => onState?.('connected'); source.onmessage = onEvent; source.onerror = () => onState?.(source.readyState === EventSource.CLOSED ? 'offline' : 'reconnecting'); return source }
