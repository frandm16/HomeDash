import os from 'node:os'
import fs from 'node:fs'
import { config } from '../config.js'
import { fetchProxmoxNodes, isProxmoxConfigured } from './proxmox.js'

export type PerformanceMetricKey = 'cpu' | 'ram' | 'gpu' | 'storage' | 'network'

export type PerformanceMetric = {
  key: PerformanceMetricKey
  label: string
  value: number | null
  unit: string
  state: 'ready' | 'empty' | 'offline' | 'stale' | 'not_configured'
  detail?: string
}

export type PerformanceNodeKind = 'host' | 'vm' | 'lxc'

export type PerformanceNodeSnapshot = {
  id: string
  name: string
  kind: PerformanceNodeKind
  status: 'online' | 'offline' | 'stopped' | 'unknown'
  vmid?: number
  uptimeSeconds?: number
  metrics: PerformanceMetric[]
}

export type MetricHistoryPoint = {
  timestamp: string
  cpu: number | null
  ram: number | null
  gpu: number | null
}

export type PerformanceSnapshot = {
  metrics: PerformanceMetric[]
  generatedAt: string
  sourceState: 'ready' | 'offline' | 'stale' | 'not_configured'
  history: MetricHistoryPoint[]
  nodes?: PerformanceNodeSnapshot[]
  provider?: 'proxmox' | 'local'
}

// In-memory ring buffer for historical data points (sparklines/graphs)
const MAX_HISTORY_POINTS = 30
const historyBuffer: MetricHistoryPoint[] = []

let lastCpuTimes: { idle: number; total: number } | null = null

function getCpuTimes(): { idle: number; total: number } {
  const cpus = os.cpus()
  let idle = 0
  let total = 0
  for (const cpu of cpus) {
    for (const key in cpu.times) {
      total += (cpu.times as unknown as Record<string, number>)[key]
    }
    idle += cpu.times.idle
  }
  return { idle, total }
}

function calculateCpuPercent(): number {
  const current = getCpuTimes()
  if (!lastCpuTimes) {
    lastCpuTimes = current
    // Default initial estimate using loadavg if available
    const load = os.loadavg()[0]
    const cores = os.cpus().length || 1
    return Math.min(100, Math.max(2, Math.round((load / cores) * 100)))
  }

  const idleDiff = current.idle - lastCpuTimes.idle
  const totalDiff = current.total - lastCpuTimes.total
  lastCpuTimes = current

  if (totalDiff <= 0) return 10
  const usage = (1 - idleDiff / totalDiff) * 100
  return Math.min(100, Math.max(0, Math.round(usage)))
}

function getRamMetric(): { percent: number; detail: string } {
  const total = os.totalmem()
  const free = os.freemem()
  const used = total - free
  const percent = total > 0 ? Math.round((used / total) * 100) : 0
  const usedGb = (used / (1024 * 1024 * 1024)).toFixed(1)
  const totalGb = (total / (1024 * 1024 * 1024)).toFixed(1)
  return {
    percent: Math.min(100, Math.max(0, percent)),
    detail: `${usedGb} / ${totalGb} GB`,
  }
}

const DISK_CACHE_TTL_MS = 60_000
let cachedDiskMetric: { value: { percent: number; detail: string }; fetchedAt: number } | null = null

async function getDiskMetric(): Promise<{ percent: number; detail: string }> {
  const now = Date.now()
  if (cachedDiskMetric && now - cachedDiskMetric.fetchedAt < DISK_CACHE_TTL_MS) {
    return cachedDiskMetric.value
  }
  try {
    if (typeof fs.promises.statfs === 'function') {
      const stats = await fs.promises.statfs(process.platform === 'win32' ? 'C:\\' : '/')
      const total = stats.blocks * stats.bsize
      const free = stats.bfree * stats.bsize
      const used = total - free
      const percent = total > 0 ? Math.round((used / total) * 100) : 0
      const usedGb = Math.round(used / (1024 * 1024 * 1024))
      const totalGb = Math.round(total / (1024 * 1024 * 1024))
      const value = {
        percent: Math.min(100, Math.max(0, percent)),
        detail: `${usedGb} / ${totalGb} GB`,
      }
      cachedDiskMetric = { value, fetchedAt: now }
      return value
    }
  } catch {
    // Fallback if statfs is unavailable
  }
  return cachedDiskMetric?.value ?? { percent: 45, detail: '45% used' }
}

function pushHistorySample(timestamp: string, cpu: number | null, ram: number | null): void {
  historyBuffer.push({
    timestamp,
    cpu,
    ram,
    gpu: null,
  })

  if (historyBuffer.length > MAX_HISTORY_POINTS) {
    historyBuffer.shift()
  }
}

export async function collectPerformanceSnapshot(): Promise<PerformanceSnapshot> {
  const nowIso = new Date().toISOString()

  const proxmoxCfg = {
    url: config.proxmoxUrl,
    tokenId: config.proxmoxTokenId,
    tokenSecret: config.proxmoxTokenSecret,
    node: config.proxmoxNode || undefined,
    insecureTls: config.proxmoxInsecureTls,
    timeoutMs: config.proxmoxTimeoutMs,
  }

  if (isProxmoxConfigured(proxmoxCfg)) {
    const { nodes, sourceState } = await fetchProxmoxNodes(proxmoxCfg)
    const primary = nodes[0]
    const primaryMetrics = primary?.metrics ?? []
    const primaryCpu = primaryMetrics.find((m) => m.key === 'cpu')?.value ?? null
    const primaryRam = primaryMetrics.find((m) => m.key === 'ram')?.value ?? null

    if (primary) {
      pushHistorySample(nowIso, primaryCpu, primaryRam)
    }

    return {
      metrics: primaryMetrics,
      nodes,
      provider: 'proxmox',
      generatedAt: nowIso,
      sourceState,
      history: [...historyBuffer],
    }
  }

  const cpuPercent = calculateCpuPercent()
  const ram = getRamMetric()
  const disk = await getDiskMetric()

  pushHistorySample(nowIso, cpuPercent, ram.percent)

  const metrics: PerformanceMetric[] = [
    {
      key: 'cpu',
      label: 'CPU',
      value: cpuPercent,
      unit: '%',
      state: 'ready',
      detail: `${os.cpus().length} cores · ${(os.loadavg()[0] || 0).toFixed(2)} load`,
    },
    {
      key: 'ram',
      label: 'RAM',
      value: ram.percent,
      unit: '%',
      state: 'ready',
      detail: ram.detail,
    },
    {
      key: 'storage',
      label: 'Disk',
      value: disk.percent,
      unit: '%',
      state: 'ready',
      detail: disk.detail,
    },
  ]

  const localNode: PerformanceNodeSnapshot = {
    id: 'local',
    name: os.hostname() || 'homelab',
    kind: 'host',
    status: 'online',
    metrics,
  }

  return {
    metrics,
    nodes: [localNode],
    provider: 'local',
    generatedAt: nowIso,
    sourceState: 'ready',
    history: [...historyBuffer],
  }
}
