export type ServiceStatus = 'online' | 'degraded' | 'offline' | 'unknown'

export type Service = {
  name: string
  description: string
  url: string
  status: ServiceStatus
  host: string
}

export type DashboardNotification = {
  id: string
  source: string
  title: string
  body: string
  level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'
  url?: string
  read: boolean
  createdAt: string
}

export type DashboardSnapshot = {
  services: Service[]
  notifications: DashboardNotification[]
  unreadNotifications: number
  generatedAt: string
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api'

export async function fetchDashboard(signal?: AbortSignal): Promise<DashboardSnapshot> {
  const response = await fetch(`${apiBaseUrl}/v1/dashboard`, { signal })
  if (!response.ok) {
    throw new Error(`Dashboard API returned ${response.status}`)
  }
  return response.json() as Promise<DashboardSnapshot>
}
