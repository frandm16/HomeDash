import type { ServiceSummary } from '../types.js'

export const serviceCatalog: ServiceSummary[] = [
  {
    name: 'Notification Center',
    description: 'Central notification inbox',
    url: 'https://notifications.frandm.dev',
    status: 'unknown',
    host: '192.168.1.52:7778',
  },
  {
    name: 'Proxmox',
    description: 'Virtualization node management',
    url: 'https://proxmox.frandm.dev',
    status: 'unknown',
    host: '192.168.1.50:8006',
  },
  {
    name: 'Dokploy',
    description: 'Application deployment platform',
    url: 'https://dokploy.frandm.dev',
    status: 'unknown',
    host: '192.168.1.52:3000',
  },
  {
    name: 'Pi-hole',
    description: 'Network-wide DNS filtering',
    url: 'https://pihole.frandm.dev',
    status: 'unknown',
    host: '192.168.1.51:8080',
  },
]
