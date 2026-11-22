import { pool } from '../db.js'

export type MetricLabels = Record<string, string>
type Counter = { value: number; labels: MetricLabels }
type Histogram = { count: number; sum: number; labels: MetricLabels }

const counters = new Map<string, Counter[]>()
const histograms = new Map<string, Histogram[]>()
const maxLabelValueLength = 80

const normalizeLabels = (labels: MetricLabels = {}): MetricLabels => Object.fromEntries(
  Object.entries(labels).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => [key, value.slice(0, maxLabelValueLength)]),
)

const sameLabels = (left: MetricLabels, right: MetricLabels): boolean => JSON.stringify(left) === JSON.stringify(right)

const getCounter = (name: string, labels: MetricLabels): Counter => {
  const normalized = normalizeLabels(labels)
  const entries = counters.get(name) ?? []
  let entry = entries.find((candidate) => sameLabels(candidate.labels, normalized))
  if (!entry) { entry = { value: 0, labels: normalized }; entries.push(entry); counters.set(name, entries) }
  return entry
}

const getHistogram = (name: string, labels: MetricLabels): Histogram => {
  const normalized = normalizeLabels(labels)
  const entries = histograms.get(name) ?? []
  let entry = entries.find((candidate) => sameLabels(candidate.labels, normalized))
  if (!entry) { entry = { count: 0, sum: 0, labels: normalized }; entries.push(entry); histograms.set(name, entries) }
  return entry
}

export function incrementMetric(name: string, labels: MetricLabels = {}, value = 1): void {
  getCounter(name, labels).value += value
}

export function observeMetric(name: string, value: number, labels: MetricLabels = {}): void {
  const histogram = getHistogram(name, labels)
  histogram.count += 1
  histogram.sum += value
}

const formatLabels = (labels: MetricLabels): string => {
  const entries = Object.entries(labels)
  return entries.length === 0 ? '' : `{${entries.map(([key, value]) => `${key}="${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`).join(',')}}`
}

export function metricsText(): string {
  const lines: string[] = []
  for (const [name, entries] of counters) for (const entry of entries) lines.push(`${name}${formatLabels(entry.labels)} ${entry.value}`)
  for (const [name, entries] of histograms) for (const entry of entries) {
    lines.push(`${name}_count${formatLabels(entry.labels)} ${entry.count}`)
    lines.push(`${name}_sum${formatLabels(entry.labels)} ${entry.sum}`)
  }
  return `${lines.join('\n')}\n`
}

export function resetMetrics(): void { counters.clear(); histograms.clear() }

export async function cleanupExpiredSessions(): Promise<number> {
  const result = await pool.query('DELETE FROM sessions WHERE expires_at < NOW() OR revoked_at < NOW() - INTERVAL \'30 days\'')
  incrementMetric('homedash_sessions_cleanup_total', {}, result.rowCount ?? 0)
  return result.rowCount ?? 0
}
