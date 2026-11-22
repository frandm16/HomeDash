import type { DashboardNotification, DashboardSnapshot, ServiceSummary } from './types.js'

const services: ServiceSummary[] = [
  {
    name: 'Notification Center',
    description: 'Central notification inbox',
    url: 'https://notifications.frandm.dev',
    status: 'online',
    host: '192.168.1.52:7778',
  },
  {
    name: 'Proxmox',
    description: 'Virtualization node management',
    url: 'https://proxmox.frandm.dev',
    status: 'online',
    host: '192.168.1.50:8006',
  },
  {
    name: 'Dokploy',
    description: 'Application deployment platform',
    url: 'https://dokploy.frandm.dev',
    status: 'degraded',
    host: '192.168.1.52:3000',
  },
  {
    name: 'Pi-hole',
    description: 'Network-wide DNS filtering',
    url: 'https://pihole.frandm.dev',
    status: 'online',
    host: '192.168.1.51:8080',
  },
]

const notifications: DashboardNotification[] = [
  {
    id: 'prototype-1',
    source: 'Proxmox',
    title: 'Backup completed successfully',
    body: 'VM 200 · dokploy-vm',
    level: 'SUCCESS',
    read: false,
    createdAt: '2026-11-22T08:30:00.000Z',
  },
  {
    id: 'prototype-2',
    source: 'System',
    title: 'Disk usage is above 80%',
    body: 'dokploy-vm · /var/lib/docker',
    level: 'WARNING',
    read: false,
    createdAt: '2026-11-22T08:08:00.000Z',
  },
  {
    id: 'prototype-3',
    source: 'StudyZen',
    title: 'Exam reminder',
    body: 'Artificial Intelligence · tomorrow',
    level: 'INFO',
    read: false,
    createdAt: '2026-11-22T07:42:00.000Z',
  },
]

export const getSnapshot = (): DashboardSnapshot => ({
  services,
  notifications,
  unreadNotifications: notifications.filter((notification) => !notification.read).length,
  generatedAt: new Date().toISOString(),
})
