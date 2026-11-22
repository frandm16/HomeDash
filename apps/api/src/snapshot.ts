import { createNotificationCenterAdapter, type NotificationCenterAdapter } from './adapters/notification-center.js'
import { serviceCatalog } from './adapters/service-catalog.js'
import type { DashboardNotification, DashboardSnapshot, ServiceSummary } from './types.js'
import { config } from './config.js'
import { listServices } from './infrastructure/db/repositories/services.js'
import { checkServices } from './adapters/service-health.js'

type SnapshotSources = {
  notifications: NotificationCenterAdapter
}

const fallbackNotifications: DashboardNotification[] = [
  {
    id: 'fallback-1',
    source: 'Proxmox',
    title: 'Backup completed successfully',
    body: 'VM 200 · dokploy-vm',
    level: 'SUCCESS',
    read: false,
    createdAt: '2026-11-22T08:30:00.000Z',
  },
  {
    id: 'fallback-2',
    source: 'System',
    title: 'Disk usage is above 80%',
    body: 'dokploy-vm · /var/lib/docker',
    level: 'WARNING',
    read: false,
    createdAt: '2026-11-22T08:08:00.000Z',
  },
  {
    id: 'fallback-3',
    source: 'StudyZen',
    title: 'Exam reminder',
    body: 'Artificial Intelligence · tomorrow',
    level: 'INFO',
    read: false,
    createdAt: '2026-11-22T07:42:00.000Z',
  },
]

const fallbackServices: ServiceSummary[] = serviceCatalog.map((service) => ({
  ...service,
  status: service.name === 'Notification Center' ? 'offline' : 'unknown',
}))

const createFallbackAdapter = (): NotificationCenterAdapter => ({
  async getNotifications() {
    return fallbackNotifications
  },
  async getUnreadCount() {
    return fallbackNotifications.filter((notification) => !notification.read).length
  },
})

export const createSnapshotService = (sources: SnapshotSources) => ({
  async getSnapshot(): Promise<DashboardSnapshot> {
    const [notificationsResult, unreadResult] = await Promise.allSettled([
      sources.notifications.getNotifications(),
      sources.notifications.getUnreadCount(),
    ])
    const notifications = notificationsResult.status === 'fulfilled' ? notificationsResult.value : []
    const unreadNotifications = unreadResult.status === 'fulfilled' ? unreadResult.value : notifications.filter((notification) => !notification.read).length
    const notificationsReady = notificationsResult.status === 'fulfilled' || unreadResult.status === 'fulfilled'
    let services = fallbackServices
    let servicesReady: 'ready' | 'offline' | 'not_configured' = 'not_configured'
    try {
      const configured = await listServices()
      const results = await checkServices(configured.filter((service) => service.healthcheckUrl).map((service) => ({ id: service.id, url: service.healthcheckUrl! })))
      const health = new Map(results.map((result) => [result.id, result]))
      services = configured.map((service) => ({ name: service.name, description: service.description, url: service.url, host: service.host ?? '', status: health.get(service.id)?.status ?? 'unknown' }))
      servicesReady = 'ready'
    } catch { servicesReady = 'offline' }
    return {
      services,
      notifications,
      unreadNotifications,
      generatedAt: new Date().toISOString(),
      sourceStates: { notifications: notificationsReady ? 'ready' : 'offline', services: servicesReady },
    }
  },
})

export const createDevelopmentSources = (): SnapshotSources => {
  const baseUrl = process.env.NOTIFICATION_CENTER_URL
  const readToken = process.env.NOTIFICATION_CENTER_READ_TOKEN

  if (!baseUrl) {
    return { notifications: createFallbackAdapter() }
  }

  return {
    notifications: createNotificationCenterAdapter({
      baseUrl,
      readToken,
      timeoutMs: config.notificationCenterTimeoutMs,
    }),
  }
}
