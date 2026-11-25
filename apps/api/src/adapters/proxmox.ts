import http from 'node:http'
import https from 'node:https'
import type { PerformanceMetric, PerformanceNodeKind, PerformanceNodeSnapshot } from './performance.js'

export type ProxmoxConfig = {
  url: string
  tokenId: string
  tokenSecret: string
  node?: string
  insecureTls?: boolean
  timeoutMs?: number
}

export type ProxmoxClusterResource = {
  id?: string
  type?: string
  node?: string
  name?: string
  vmid?: number
  status?: string
  template?: number
  cpu?: number
  maxcpu?: number
  mem?: number
  maxmem?: number
  disk?: number
  maxdisk?: number
  uptime?: number
}

const KIND_ORDER: Record<PerformanceNodeKind, number> = {
  host: 0,
  vm: 1,
  lxc: 2,
}

export function isProxmoxConfigured(cfg: ProxmoxConfig): boolean {
  return Boolean(cfg.url && cfg.tokenId && cfg.tokenSecret)
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, Math.round(value)))
}

function formatGigabytes(bytes: number, decimals = 1): string {
  const gb = bytes / (1024 * 1024 * 1024)
  return gb >= 100 ? Math.round(gb).toString() : gb.toFixed(decimals)
}

function normalizeStatus(status?: string): PerformanceNodeSnapshot['status'] {
  if (status === 'online' || status === 'running') return 'online'
  if (status === 'stopped') return 'stopped'
  if (status === 'offline') return 'offline'
  return 'unknown'
}

export function mapProxmoxResourcesToNodes(
  resources: ProxmoxClusterResource[],
  filterNode?: string,
): PerformanceNodeSnapshot[] {
  const normalizedFilter = filterNode?.trim().toLowerCase() ?? ''
  const nodes: PerformanceNodeSnapshot[] = []

  for (const item of resources) {
    if (item.template === 1) continue

    let kind: PerformanceNodeKind | null = null
    if (item.type === 'node') kind = 'host'
    else if (item.type === 'qemu') kind = 'vm'
    else if (item.type === 'lxc') kind = 'lxc'
    else continue

    const nodeName = (item.node ?? '').trim()
    if (normalizedFilter && nodeName.toLowerCase() !== normalizedFilter) continue

    const status = normalizeStatus(item.status)
    const isRunning = status === 'online'
    const displayName = kind === 'host'
      ? (nodeName || item.name || 'proxmox')
      : (item.name?.trim() || `${kind.toUpperCase()} ${item.vmid ?? ''}`.trim())

    const id = kind === 'host'
      ? `node:${displayName}`
      : `${item.type}:${item.vmid ?? displayName}`

    const cpuRaw = typeof item.cpu === 'number' ? item.cpu * 100 : 0
    const cpuPercent = isRunning ? clampPercent(cpuRaw) : 0
    const cores = typeof item.maxcpu === 'number' && item.maxcpu > 0 ? item.maxcpu : null

    const memUsed = typeof item.mem === 'number' ? Math.max(0, item.mem) : 0
    const memTotal = typeof item.maxmem === 'number' ? Math.max(0, item.maxmem) : 0
    const ramPercent = isRunning && memTotal > 0 ? clampPercent((memUsed / memTotal) * 100) : 0
    const ramDetail = memTotal > 0
      ? `${formatGigabytes(memUsed)} / ${formatGigabytes(memTotal)} GB`
      : 'No RAM data'

    const diskUsed = typeof item.disk === 'number' ? Math.max(0, item.disk) : 0
    const diskTotal = typeof item.maxdisk === 'number' ? Math.max(0, item.maxdisk) : 0
    const hasExactDiskUsage = diskTotal > 0 && (diskUsed > 0 || kind !== 'vm')
    const diskPercent = hasExactDiskUsage ? clampPercent((diskUsed / diskTotal) * 100) : null
    const diskDetail = hasExactDiskUsage
      ? `${formatGigabytes(diskUsed, 0)} / ${formatGigabytes(diskTotal, 0)} GB`
      : diskTotal > 0
        ? `${formatGigabytes(diskTotal, 0)} GB alloc`
        : 'No disk data'

    const metrics: PerformanceMetric[] = [
      {
        key: 'cpu',
        label: 'CPU',
        value: isRunning ? cpuPercent : null,
        unit: '%',
        state: isRunning ? 'ready' : 'offline',
        detail: cores ? `${cores} ${cores === 1 ? 'core' : 'cores'}` : undefined,
      },
      {
        key: 'ram',
        label: 'RAM',
        value: isRunning && memTotal > 0 ? ramPercent : null,
        unit: '%',
        state: isRunning && memTotal > 0 ? 'ready' : 'offline',
        detail: ramDetail,
      },
      {
        key: 'storage',
        label: 'Disk',
        value: diskPercent,
        unit: '%',
        state: diskPercent !== null ? 'ready' : 'empty',
        detail: diskDetail,
      },
    ]

    nodes.push({
      id,
      name: displayName,
      kind,
      status,
      ...(typeof item.vmid === 'number' ? { vmid: item.vmid } : {}),
      ...(typeof item.uptime === 'number' ? { uptimeSeconds: item.uptime } : {}),
      metrics,
    })
  }

  return nodes.sort((a, b) => {
    const kindDiff = KIND_ORDER[a.kind] - KIND_ORDER[b.kind]
    if (kindDiff !== 0) return kindDiff
    if (a.vmid !== undefined && b.vmid !== undefined && a.vmid !== b.vmid) {
      return a.vmid - b.vmid
    }
    return a.name.localeCompare(b.name)
  })
}

async function requestProxmoxJson<T>(cfg: ProxmoxConfig, path: string): Promise<T> {
  const targetUrl = new URL(path, `${cfg.url}/`)
  const isHttps = targetUrl.protocol === 'https:'
  const transport = isHttps ? https : http
  const timeoutMs = cfg.timeoutMs ?? 5000

  return new Promise<T>((resolve, reject) => {
    const req = transport.request(
      targetUrl,
      {
        method: 'GET',
        headers: {
          Authorization: `PVEAPIToken=${cfg.tokenId}=${cfg.tokenSecret}`,
          Accept: 'application/json',
        },
        timeout: timeoutMs,
        ...(isHttps ? { rejectUnauthorized: !cfg.insecureTls } : {}),
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8')
          const statusCode = res.statusCode ?? 500
          if (statusCode < 200 || statusCode >= 300) {
            reject(new Error(`Proxmox API returned HTTP ${statusCode}`))
            return
          }
          try {
            resolve(JSON.parse(body) as T)
          } catch {
            reject(new Error('Proxmox API returned invalid JSON'))
          }
        })
      },
    )

    req.on('timeout', () => {
      req.destroy(new Error(`Proxmox API timed out after ${timeoutMs}ms`))
    })
    req.on('error', reject)
    req.end()
  })
}

const CACHE_TTL_MS = 4_000
const MAX_STALE_MS = 30_000

type CachedNodes = {
  nodes: PerformanceNodeSnapshot[]
  fetchedAt: number
}

let cachedNodes: CachedNodes | null = null

export function resetProxmoxCache(): void {
  cachedNodes = null
}

export async function fetchProxmoxNodes(
  cfg: ProxmoxConfig,
): Promise<{ nodes: PerformanceNodeSnapshot[]; sourceState: 'ready' | 'stale' | 'offline' }> {
  const now = Date.now()
  if (cachedNodes && now - cachedNodes.fetchedAt < CACHE_TTL_MS) {
    return { nodes: cachedNodes.nodes, sourceState: 'ready' }
  }

  try {
    const payload = await requestProxmoxJson<{ data?: ProxmoxClusterResource[] }>(
      cfg,
      '/api2/json/cluster/resources',
    )
    const resources = Array.isArray(payload.data) ? payload.data : []
    const nodes = mapProxmoxResourcesToNodes(resources, cfg.node)
    cachedNodes = { nodes, fetchedAt: now }
    return { nodes, sourceState: 'ready' }
  } catch {
    if (cachedNodes && now - cachedNodes.fetchedAt < MAX_STALE_MS) {
      return { nodes: cachedNodes.nodes, sourceState: 'stale' }
    }
    return { nodes: [], sourceState: 'offline' }
  }
}
