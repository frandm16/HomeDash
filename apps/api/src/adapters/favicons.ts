export type CachedFavicon = {
  body: Buffer
  contentType: string
  expiresAt: number
}

const PUBLIC_DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i
const PRIVATE_TLD_RE = /\.(local|lan|internal|home|arpa|localhost)$/i
const MAX_CACHE_ENTRIES = 200
const POSITIVE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const NEGATIVE_TTL_MS = 5 * 60 * 1000
const MAX_ICON_BYTES = 64 * 1024

export function isPublicFaviconDomain(domain: string): boolean {
  const normalized = domain.trim().toLowerCase()
  if (!normalized || normalized === 'localhost') return false
  if (!PUBLIC_DOMAIN_RE.test(normalized)) return false
  if (PRIVATE_TLD_RE.test(normalized)) return false
  return true
}

export function createFaviconService(fetchImpl: typeof fetch = fetch, timeoutMs = 2500) {
  const cache = new Map<string, CachedFavicon | { notFound: true; expiresAt: number }>()
  const inFlight = new Map<string, Promise<CachedFavicon | null>>()

  function setCacheEntry(key: string, value: CachedFavicon | { notFound: true; expiresAt: number }) {
    if (cache.size >= MAX_CACHE_ENTRIES) {
      const oldest = cache.keys().next().value
      if (oldest) cache.delete(oldest)
    }
    cache.set(key, value)
  }

  async function fetchCandidate(url: string): Promise<CachedFavicon | null> {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) })
    if (!response.ok) return null
    const contentType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
    if (!contentType.startsWith('image/')) return null
    const arrayBuffer = await response.arrayBuffer()
    if (arrayBuffer.byteLength === 0 || arrayBuffer.byteLength > MAX_ICON_BYTES) return null
    return {
      body: Buffer.from(arrayBuffer),
      contentType,
      expiresAt: Date.now() + POSITIVE_TTL_MS,
    }
  }

  async function resolveUncached(domain: string): Promise<CachedFavicon | null> {
    const candidates = [
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`,
      `https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`,
    ]
    for (const url of candidates) {
      try {
        const icon = await fetchCandidate(url)
        if (icon) {
          setCacheEntry(domain, icon)
          return icon
        }
      } catch {
        // Try next candidate
      }
    }
    setCacheEntry(domain, { notFound: true, expiresAt: Date.now() + NEGATIVE_TTL_MS })
    return null
  }

  return {
    async getFavicon(rawDomain: string): Promise<CachedFavicon | null> {
      const domain = rawDomain.trim().toLowerCase()
      if (!isPublicFaviconDomain(domain)) return null

      const now = Date.now()
      const hit = cache.get(domain)
      if (hit) {
        if (hit.expiresAt > now) {
          return 'notFound' in hit ? null : hit
        }
        cache.delete(domain)
      }

      const pending = inFlight.get(domain)
      if (pending) return pending

      const promise = resolveUncached(domain).finally(() => {
        inFlight.delete(domain)
      })
      inFlight.set(domain, promise)
      return promise
    },
  }
}
