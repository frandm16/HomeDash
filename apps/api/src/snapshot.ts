import { createNotificationCenterAdapter, type NotificationCenterAdapter } from './adapters/notification-center.js'
import { serviceCatalog } from './adapters/service-catalog.js'
import type { DashboardNotification, DashboardSnapshot, ServiceSummary } from './types.js'
import { config } from './config.js'
import { listServices } from './infrastructure/db/repositories/services.js'
import { checkServices } from './adapters/service-health.js'
import { publishEvent } from './infrastructure/events.js'

type SnapshotSources = {
  notifications: NotificationCenterAdapter | null
}

type SnapshotOptions = {
  freshTtlMs?: number
  maxStaleMs?: number
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

export const createSnapshotService = (sources: SnapshotSources, options: SnapshotOptions = {}) => {
  const freshTtlMs = options.freshTtlMs ?? 10_000
  const maxStaleMs = options.maxStaleMs ?? 120_000
  let cached: { snapshot: DashboardSnapshot; fetchedAt: number } | null = null
  let inFlight: Promise<DashboardSnapshot> | null = null

  async function computeSnapshot(): Promise<DashboardSnapshot> {
    const notificationsSource = sources.notifications
    const [notificationsResult, unreadResult, servicesOutcome] = await Promise.all([
      notificationsSource
        ? notificationsSource.getNotifications().then(
            value => ({ ok: true as const, value }),
            () => ({ ok: false as const, value: [] as DashboardNotification[] })
          )
        : Promise.resolve({ ok: false as const, value: [] as DashboardNotification[] }),
      notificationsSource
        ? notificationsSource.getUnreadCount().then(
            value => ({ ok: true as const, value }),
            () => ({ ok: false as const, value: -1 })
          )
        : Promise.resolve({ ok: false as const, value: 0 }),
      (async () => {
        try {
          const configured = await listServices()
          const results = await checkServices(
            configured
              .filter((service) => service.healthcheckUrl)
              .map((service) => ({ id: service.id, url: service.healthcheckUrl! }))
          )
          const health = new Map(results.map((result) => [result.id, result]))
          const mapped: ServiceSummary[] = configured.map((service) => ({
            name: service.name,
            description: service.description,
            url: service.url,
            host: service.host ?? '',
            status: health.get(service.id)?.status ?? 'unknown',
          }))
          return { services: mapped, state: 'ready' as const }
        } catch {
          return { services: config.isProduction ? [] : fallbackServices, state: 'offline' as const }
        }
      })(),
    ])

    const notifications = notificationsResult.value
    const unreadNotifications = unreadResult.ok
      ? unreadResult.value
      : notifications.filter((notification) => !notification.read).length
    const notificationsState = !notificationsSource
      ? 'not_configured' as const
      : (notificationsResult.ok || unreadResult.ok)
        ? 'ready' as const
        : 'offline' as const

    return {
      services: servicesOutcome.services,
      notifications,
      unreadNotifications,
      generatedAt: new Date().toISOString(),
      sourceStates: {
        notifications: notificationsState,
        services: servicesOutcome.state,
      },
    }
  }

  function revalidate(notifyOnChange: boolean): Promise<DashboardSnapshot> {
    if (inFlight) return inFlight
    const previous = cached?.snapshot
    inFlight = computeSnapshot()
      .then((next) => {
        cached = { snapshot: next, fetchedAt: Date.now() }
        if (notifyOnChange && previous) {
          if (previous.unreadNotifications !== next.unreadNotifications || previous.notifications[0]?.id !== next.notifications[0]?.id) {
            publishEvent({ type: 'notification.created', source: 'snapshot' })
          } else if (JSON.stringify(previous.services) !== JSON.stringify(next.services)) {
            publishEvent({ type: 'service.status.changed', source: 'snapshot' })
          }
        }
        return next
      })
      .finally(() => {
        inFlight = null
      })
    return inFlight
  }

  return {
    async getSnapshot(): Promise<DashboardSnapshot> {
      const now = Date.now()
      if (cached) {
        const age = now - cached.fetchedAt
        if (age < freshTtlMs) {
          return cached.snapshot
        }
        if (age < maxStaleMs) {
          void revalidate(true).catch(() => undefined)
          return cached.snapshot
        }
      }
      return revalidate(false)
    },
  }
}

export const createDevelopmentSources = (): SnapshotSources => {
  const baseUrl = process.env.NOTIFICATION_CENTER_URL
  const readToken = process.env.NOTIFICATION_CENTER_READ_TOKEN

  if (!baseUrl) {
    return { notifications: config.isProduction ? null : createFallbackAdapter() }
  }

  return {
    notifications: createNotificationCenterAdapter({
      baseUrl,
      readToken,
      timeoutMs: config.notificationCenterTimeoutMs,
    }),
  }
}
