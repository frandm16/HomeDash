import type { DashboardNotification, NotificationLevel } from '../types.js'

type NotificationCenterConfig = {
  baseUrl?: string
  readToken?: string
  timeoutMs: number
}

type NotificationCenterItem = {
  id: number | string
  source?: string
  title?: string
  body?: string
  level?: string
  url?: string | null
  read?: boolean
  isRead?: boolean
  createdAt?: string
}

type NotificationCenterListResponse = {
  content?: NotificationCenterItem[]
  notifications?: NotificationCenterItem[]
}

export type NotificationCenterAdapter = {
  getNotifications(): Promise<DashboardNotification[]>
  getUnreadCount(): Promise<number>
}

const levels = new Set<NotificationLevel>(['INFO', 'SUCCESS', 'WARNING', 'ERROR'])

const normalizeLevel = (level: string | undefined): NotificationLevel => {
  const normalized = level?.toUpperCase() as NotificationLevel | undefined
  return normalized && levels.has(normalized) ? normalized : 'INFO'
}

const normalizeItem = (item: NotificationCenterItem): DashboardNotification => ({
  id: String(item.id),
  source: item.source ?? 'Notification Center',
  title: item.title ?? 'Untitled notification',
  body: item.body ?? '',
  level: normalizeLevel(item.level),
  ...(item.url ? { url: item.url } : {}),
  read: item.read ?? item.isRead ?? false,
  createdAt: item.createdAt ?? new Date(0).toISOString(),
})

const readJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    throw new Error(`Notification Center returned ${response.status}`)
  }
  return response.json() as Promise<T>
}

export const createNotificationCenterAdapter = (config: NotificationCenterConfig): NotificationCenterAdapter => {
  if (!config.baseUrl) {
    throw new Error('Notification Center base URL is required')
  }

  const request = async (path: string): Promise<Response> => {
    const headers = config.readToken ? { Authorization: `Bearer ${config.readToken}` } : undefined
    return fetch(new URL(path, config.baseUrl), {
      headers,
      signal: AbortSignal.timeout(config.timeoutMs),
    })
  }

  return {
    async getNotifications() {
      const payload = await readJson<NotificationCenterListResponse | NotificationCenterItem[]>(await request('/api/v1/notifications'))
      const items = Array.isArray(payload) ? payload : (payload.notifications ?? payload.content ?? [])
      return items.map(normalizeItem)
    },
    async getUnreadCount() {
      const payload = await readJson<{ unreadCount?: number }>(await request('/api/v1/notifications/unread-count'))
      return payload.unreadCount ?? 0
    },
  }
}
