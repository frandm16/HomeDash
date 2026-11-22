import type { ServiceStatus } from '../types.js'

export type HealthCheckTarget = { id: string; url: string; timeoutMs?: number }
export type HealthCheckResult = { id: string; status: ServiceStatus; latencyMs: number; checkedAt: string; error?: string }

const privateHost = /^(localhost|127\.|0\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/i

function validateTarget(url: string): URL {
  const parsed = new URL(url)
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('Only credential-free HTTP URLs are allowed')
  if (privateHost.test(parsed.hostname) === false) throw new Error('Healthcheck host is not allowlisted')
  return parsed
}

export async function checkService(target: HealthCheckTarget): Promise<HealthCheckResult> {
  const started = Date.now()
  try {
    const url = validateTarget(target.url)
    const response = await fetch(url, { signal: AbortSignal.timeout(target.timeoutMs ?? 3000), redirect: 'error' })
    const status: ServiceStatus = response.ok ? 'online' : response.status >= 500 ? 'offline' : 'degraded'
    return { id: target.id, status, latencyMs: Date.now() - started, checkedAt: new Date().toISOString() }
  } catch (error) {
    return { id: target.id, status: 'offline', latencyMs: Date.now() - started, checkedAt: new Date().toISOString(), error: error instanceof Error ? error.message : 'healthcheck failed' }
  }
}

export async function checkServices(targets: HealthCheckTarget[], concurrency = 4): Promise<HealthCheckResult[]> {
  const results: HealthCheckResult[] = []
  let cursor = 0
  async function worker() {
    while (cursor < targets.length) {
      const target = targets[cursor++]
      if (target) results.push(await checkService(target))
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, () => worker()))
  return results
}
