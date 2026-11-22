export type ServiceStatus = 'online' | 'degraded' | 'offline' | 'unknown'

export type ServiceSummary = {
  name: string
  description: string
  url: string
  status: ServiceStatus
  host: string
}

export type NotificationLevel = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'

export type DashboardNotification = {
  id: string
  source: string
  title: string
  body: string
  level: NotificationLevel
  url?: string
  read: boolean
  createdAt: string
}

export type DashboardSnapshot = {
  services: ServiceSummary[]
  notifications: DashboardNotification[]
  unreadNotifications: number
  generatedAt: string
}
