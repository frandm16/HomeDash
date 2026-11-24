#!/usr/bin/env node
import { createServer, request as httpRequest } from 'node:http'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { gzipSync } from 'node:zlib'
import puppeteer from 'puppeteer'

const { values: args } = parseArgs({
  options: {
    url:        { type: 'string',  default: 'http://localhost:5173' },
    runs:       { type: 'string',  default: '5' },
    json:       { type: 'string' },
    compare:    { type: 'string' },
    user:       { type: 'string',  default: 'admin' },
    password:   { type: 'string',  default: 'admin' },
    standalone: { type: 'boolean', default: false },
  }
})

const RUNS = parseInt(args.runs, 10)
const WEB_ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIST_DIR = join(WEB_ROOT, 'dist')

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
}

async function startStandaloneStack() {
  process.env.LOG_LEVEL = 'warn'
  const { buildApp } = await import('../../api/dist/app.js')
  const { SESSION_COOKIE } = await import('../../api/dist/auth.js')

  const demoUser = { id: '11111111-1111-4111-8111-111111111111', username: args.user, isAdmin: true }
  const session = {
    user: demoUser,
    token: 'bench-session-token',
    expiresAt: new Date(Date.now() + 86_400_000),
    lastSeenAt: new Date(),
    csrfToken: 'a'.repeat(64),
    csrfTokenHash: 'ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb',
  }
  const profileId = '22222222-2222-4222-8222-222222222222'
  const bookmarksWidgetId = '33333333-3333-4333-8333-333333333333'
  const dbDelay = () => new Promise(r => setTimeout(r, 2))

  const profiles = [{ id: profileId, dashboardId: 'dash-1', profileKey: 'desktop', layoutVersion: 1 }]
  const widgets = [
    { id: 'w-clock', widgetType: 'clock-hero', widgetVersion: 1, configuration: { clockStyle: 'digital-modern' }, layout: { x: 0, y: 0, width: 4, height: 2 }, isEnabled: true },
    { id: 'w-search', widgetType: 'search', widgetVersion: 1, configuration: { provider: 'google', searchStyle: 'pill' }, layout: { x: 4, y: 0, width: 6, height: 1 }, isEnabled: true },
    { id: bookmarksWidgetId, widgetType: 'bookmarks', widgetVersion: 1, configuration: { bookmarkStyle: 'tiles' }, layout: { x: 0, y: 2, width: 6, height: 4 }, isEnabled: true },
    { id: 'w-notifs', widgetType: 'notifications', widgetVersion: 1, configuration: { notificationStyle: 'cards', maxItems: 6 }, layout: { x: 6, y: 2, width: 5, height: 4 }, isEnabled: true },
    { id: 'w-perf', widgetType: 'homelab-performance', widgetVersion: 1, configuration: { perfStyle: 'radial-gauges' }, layout: { x: 11, y: 2, width: 5, height: 4 }, isEnabled: true },
  ]
  const bookmarks = [
    { id: 'b-1', widgetId: bookmarksWidgetId, name: 'Proxmox VE', url: 'http://127.0.0.1:8006', icon: '⚡', category: 'Infra', sortOrder: 0 },
    { id: 'b-2', widgetId: bookmarksWidgetId, name: 'Dokploy', url: 'http://127.0.0.1:3000', icon: '🐳', category: 'Infra', sortOrder: 1 },
    { id: 'b-3', widgetId: bookmarksWidgetId, name: 'Home Assistant', url: 'http://127.0.0.1:8123', icon: '🏠', category: 'Home', sortOrder: 2 },
    { id: 'b-4', widgetId: bookmarksWidgetId, name: 'GitHub', url: 'http://127.0.0.1:9000', icon: '🚀', category: 'Dev', sortOrder: 3 },
  ]

  const tokenFrom = req => req.headers.cookie?.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))?.[1]

  const apiApp = await buildApp({
    auth: {
      authenticate: async () => { await dbDelay(); return demoUser },
      createSession: async () => { await dbDelay(); return session },
      getSession: async token => { await dbDelay(); return token === session.token ? session : null },
      revokeAllSessions: async () => undefined,
      revokeSession: async () => undefined,
      requireAuth: async (req, reply) => {
        await dbDelay()
        const ok = tokenFrom(req) === session.token
        if (!ok) { await reply.code(401).send({ error: 'Authentication required' }); return null }
        req.auth = session
        return session
      },
    },
    dashboard: {
      ensureDashboard: async () => { await dbDelay(); return 'dash-1' },
      listDashboards: async () => { await dbDelay(); return [{ id: 'dash-1', name: 'HomeDash', isDefault: true }] },
      createDashboard: async (_u, input) => ({ id: 'dash-2', ...input }),
      updateDashboard: async () => undefined,
      deleteDashboard: async () => false,
      listProfiles: async () => { await dbDelay(); return profiles },
      updateProfile: async () => undefined,
      listWidgets: async () => { await dbDelay(); return widgets },
      createWidget: async () => undefined,
      updateWidget: async () => undefined,
      deleteWidget: async () => false,
      listBookmarks: async () => { await dbDelay(); return bookmarks },
      createBookmark: async () => undefined,
      updateBookmark: async () => undefined,
      deleteBookmark: async () => false,
    },
    recordAudit: async () => undefined,
  })

  await apiApp.listen({ host: '127.0.0.1', port: 0 })
  const apiPort = apiApp.server.address().port

  const webServer = createServer(async (req, res) => {
    const reqUrl = req.url ?? '/'
    if (reqUrl.startsWith('/api/')) {
      const proxyReq = httpRequest(
        { hostname: '127.0.0.1', port: apiPort, path: reqUrl, method: req.method, headers: req.headers },
        proxyRes => {
          res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers)
          proxyRes.pipe(res)
        }
      )
      proxyReq.on('error', () => { res.writeHead(502); res.end() })
      req.pipe(proxyReq)
      return
    }

    const cleanPath = normalize(reqUrl.split('?')[0]).replace(/^(\.\.(\/|\\|$))+/, '').replaceAll('\\', '/')
    let filePath = join(DIST_DIR, cleanPath === '/' ? 'index.html' : cleanPath)
    let isFallbackHtml = false
    try {
      const st = await stat(filePath)
      if (st.isDirectory()) filePath = join(filePath, 'index.html')
    } catch {
      filePath = join(DIST_DIR, 'index.html')
      isFallbackHtml = true
    }

    const ext = extname(filePath).toLowerCase()
    const contentType = MIME_TYPES[ext] ?? 'application/octet-stream'
    const isImmutable = cleanPath.startsWith('/assets/') && !isFallbackHtml
    const headers = {
      'Content-Type': contentType,
      'Cache-Control': isImmutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    }

    const acceptsGzip = (req.headers['accept-encoding'] ?? '').includes('gzip')
    const compressible = ['.html', '.js', '.css', '.json', '.svg'].includes(ext)

    if (acceptsGzip && compressible) {
      try {
        const precompressed = await readFile(`${filePath}.gz`)
        res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip', 'Content-Length': precompressed.length })
        res.end(precompressed)
        return
      } catch {
        const raw = await readFile(filePath)
        const gz = gzipSync(raw)
        res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip', 'Content-Length': gz.length })
        res.end(gz)
        return
      }
    }

    const raw = await readFile(filePath)
    res.writeHead(200, { ...headers, 'Content-Length': raw.length })
    res.end(raw)
  })

  await new Promise(resolve => webServer.listen(0, '127.0.0.1', resolve))
  const webPort = webServer.address().port
  return {
    baseUrl: `http://127.0.0.1:${webPort}`,
    close: async () => {
      webServer.closeAllConnections?.()
      await new Promise(resolve => webServer.close(resolve))
      apiApp.server.closeAllConnections?.()
      await apiApp.close()
    },
  }
}

async function authenticate(browser, baseUrl) {
  const page = await browser.newPage()
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
  const res = await page.evaluate(async (apiBase, user, pass) => {
    const r = await fetch(`${apiBase}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username: user, password: pass })
    })
    return { ok: r.ok, status: r.status }
  }, `${baseUrl}/api`, args.user, args.password)

  if (!res.ok) {
    console.error(`Authentication failed (HTTP ${res.status}). Check --user and --password.`)
    process.exit(1)
  }

  const cookies = await page.cookies()
  await page.close()
  return cookies
}

async function runSingle(context, baseUrl, cookies, warmMode) {
  const page = await context.newPage()
  await page.bringToFront()
  if (cookies.length) await page.setCookie(...cookies)

  const client = await page.createCDPSession()
  await client.send('Network.enable')
  await page.setCacheEnabled(warmMode)

  const transferSizes = { js: 0, css: 0, image: 0, other: 0, total: 0 }
  const reqMeta = new Map()
  let apiRequests = 0

  client.on('Network.responseReceived', evt => {
    const url = evt.response.url ?? ''
    const mime = evt.response.mimeType ?? ''
    const fromCache = Boolean(evt.response.fromDiskCache || evt.response.fromPrefetchCache)
    reqMeta.set(evt.requestId, { url, mime, fromCache })
    if (url.includes('/api/') && !url.includes('/api/v1/events')) {
      apiRequests += 1
    }
  })

  client.on('Network.loadingFinished', evt => {
    const meta = reqMeta.get(evt.requestId)
    const bytes = evt.encodedDataLength ?? 0
    if (!meta || meta.fromCache || bytes <= 0) return
    if (meta.mime.includes('javascript') || meta.url.endsWith('.js')) transferSizes.js += bytes
    else if (meta.mime.includes('css') || meta.url.endsWith('.css')) transferSizes.css += bytes
    else if (meta.mime.includes('image') || /\.(webp|avif|png|jpg|svg|ico)(\?|$)/.test(meta.url)) transferSizes.image += bytes
    else transferSizes.other += bytes
    transferSizes.total += bytes
  })

  await page.evaluateOnNewDocument(shouldClearStorage => {
    if (shouldClearStorage) {
      try { localStorage.clear() } catch { /* ignore */ }
    }
    window.__LCP__ = 0
    window.__LONG_TASKS__ = []
    const lcpObs = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) window.__LCP__ = entry.startTime
    })
    lcpObs.observe({ type: 'largest-contentful-paint', buffered: true })

    const ltObs = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) window.__LONG_TASKS__.push(entry.duration)
    })
    ltObs.observe({ type: 'longtask', buffered: true })
  }, !warmMode)

  const start = performance.now()
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })

  await page.waitForFunction(() => {
    const hasShell = document.querySelectorAll('.widget-shell').length > 0 || document.querySelector('.empty-dashboard') || document.querySelector('.login-card')
    if (!hasShell) return false
    const loadingIndicators = Array.from(document.querySelectorAll('.widget-status')).some(el => el.textContent?.includes('Loading'))
    return !loadingIndicators
  }, { timeout: 15_000 })

  const readyTime = performance.now() - start
  await new Promise(r => setTimeout(r, 150))

  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0]
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]
    const longTasks = window.__LONG_TASKS__ || []
    const tbt = longTasks.reduce((sum, d) => sum + Math.max(0, d - 50), 0)

    return {
      ttfb: nav?.responseStart ?? 0,
      fcp: fcp?.startTime ?? 0,
      lcp: window.__LCP__ || fcp?.startTime || 0,
      tbt,
      domContentLoaded: nav?.domContentLoadedEventEnd ?? 0,
      loadEvent: nav?.loadEventEnd ?? 0,
    }
  })

  await client.detach().catch(() => undefined)
  await page.close()

  return { ...metrics, loadTime: Math.round(readyTime), apiRequests, transferSizes }
}

function percentile(sorted, p) {
  const i = Math.ceil(p / 100 * sorted.length) - 1
  return sorted[Math.max(0, i)]
}

function summarize(results) {
  const keys = ['ttfb', 'fcp', 'lcp', 'tbt', 'domContentLoaded', 'loadEvent', 'loadTime']
  const summary = {}
  for (const key of keys) {
    const values = results.map(r => r[key]).sort((a, b) => a - b)
    summary[key] = {
      avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
      min: Math.round(values[0]),
      p50: Math.round(percentile(values, 50)),
      p95: Math.round(percentile(values, 95)),
      max: Math.round(values[values.length - 1]),
    }
  }

  const last = results[results.length - 1]
  const lastTransfer = last.transferSizes
  summary.apiRequests = Math.round(results.reduce((a, r) => a + r.apiRequests, 0) / results.length)
  summary.transferKB = {
    js: Number((lastTransfer.js / 1024).toFixed(1)),
    css: Number((lastTransfer.css / 1024).toFixed(1)),
    image: Number((lastTransfer.image / 1024).toFixed(1)),
    total: Number((lastTransfer.total / 1024).toFixed(1)),
  }
  return summary
}

function printTable(summary, label = 'Results') {
  console.log(`\n── ${label} (${'─'.repeat(Math.max(10, 44 - label.length))})`)
  console.log('')
  console.log('  Metric              Avg      Min      p50      p95      Max')
  console.log('  ─────────────────── ──────── ──────── ──────── ──────── ────────')
  for (const [key, vals] of Object.entries(summary)) {
    if (key === 'transferKB' || key === 'apiRequests') continue
    const { avg, min, p50, p95, max } = vals
    const pad = s => String(s).padStart(6) + 'ms'
    console.log(`  ${key.padEnd(20)} ${pad(avg)}  ${pad(min)}  ${pad(p50)}  ${pad(p95)}  ${pad(max)}`)
  }
  console.log('')
  const t = summary.transferKB
  console.log(`  API calls: ${summary.apiRequests}  |  Transfer: JS=${t.js}KB  CSS=${t.css}KB  Image=${t.image}KB  Total=${t.total}KB`)
}

function printComparison(current, baseline, title = 'Comparison') {
  console.log(`\n── ${title} ─────────────────────────────────────`)
  console.log('')
  console.log('  Metric              Baseline    Current     Delta')
  console.log('  ─────────────────── ────────── ────────── ──────────')
  for (const key of Object.keys(current)) {
    if (key === 'transferKB' || key === 'apiRequests') continue
    const bAvg = baseline[key]?.avg ?? 0
    const cAvg = current[key].avg
    const delta = cAvg - bAvg
    const pct = bAvg ? ((delta / bAvg) * 100).toFixed(1) : 'N/A'
    const sign = delta <= 0 ? '' : '+'
    const marker = delta < 0 ? ' ✓' : delta > 0 ? ' ✗' : ''
    console.log(`  ${key.padEnd(20)} ${String(bAvg).padStart(6)}ms   ${String(cAvg).padStart(6)}ms   ${sign}${delta}ms (${sign}${pct}%)${marker}`)
  }

  if (baseline.apiRequests !== undefined && current.apiRequests !== undefined) {
    const d = current.apiRequests - baseline.apiRequests
    const sign = d <= 0 ? '' : '+'
    console.log(`\n  API Requests        ${String(baseline.apiRequests).padStart(8)}   ${String(current.apiRequests).padStart(8)}   ${sign}${d}`)
  }

  if (baseline.transferKB && current.transferKB) {
    console.log('')
    for (const k of ['js', 'css', 'image', 'total']) {
      const b = baseline.transferKB[k] ?? 0
      const c = current.transferKB[k]
      const d = Number((c - b).toFixed(1))
      const sign = d <= 0 ? '' : '+'
      console.log(`  Transfer ${k.padEnd(7)} ${String(b).padStart(6)}KB   ${String(c).padStart(6)}KB   ${sign}${d}KB`)
    }
  }
}

async function main() {
  let standalone = null
  const baseUrl = args.standalone
    ? (standalone = await startStandaloneStack(), standalone.baseUrl)
    : args.url

  console.log(`HomeDash Performance Benchmark`)
  console.log(`URL: ${baseUrl}${args.standalone ? ' (standalone prod build)' : ''}  |  Runs: ${RUNS}`)
  console.log('')

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  })

  try {
    console.log('Authenticating...')
    const cookies = await authenticate(browser, baseUrl)
    console.log('Authenticated. Running Cold & Warm startpage benchmarks...\n')

    const coldResults = []
    for (let i = 0; i < RUNS; i++) {
      const ctx = await browser.createBrowserContext()
      process.stdout.write(`  [Cold ${i + 1}/${RUNS}]...`)
      const result = await runSingle(ctx, baseUrl, cookies, false)
      coldResults.push(result)
      await ctx.close()
      console.log(` Ready=${result.loadTime}ms  FCP=${result.fcp.toFixed(0)}ms  LCP=${result.lcp.toFixed(0)}ms  API=${result.apiRequests}  Total=${(result.transferSizes.total / 1024).toFixed(1)}KB`)
    }

    const warmCtx = await browser.createBrowserContext()
    // Prime HTTP cache and localStorage once
    await runSingle(warmCtx, baseUrl, cookies, true)
    const warmResults = []
    for (let i = 0; i < RUNS; i++) {
      process.stdout.write(`  [Warm ${i + 1}/${RUNS}]...`)
      const result = await runSingle(warmCtx, baseUrl, cookies, true)
      warmResults.push(result)
      console.log(` Ready=${result.loadTime}ms  FCP=${result.fcp.toFixed(0)}ms  LCP=${result.lcp.toFixed(0)}ms  API=${result.apiRequests}  Total=${(result.transferSizes.total / 1024).toFixed(1)}KB`)
    }
    await warmCtx.close()

    const summary = summarize(coldResults)
    const warmSummary = summarize(warmResults)
    printTable(summary, `Cold Load (${RUNS} runs)`)
    printTable(warmSummary, `Warm Startpage (${RUNS} runs)`)

    if (args.json) {
      const output = { timestamp: new Date().toISOString(), url: baseUrl, runs: RUNS, summary, warmSummary, raw: { cold: coldResults, warm: warmResults } }
      await writeFile(args.json, JSON.stringify(output, null, 2))
      console.log(`\nSaved to ${args.json}`)
    }

    if (args.compare) {
      try {
        const baseline = JSON.parse(await readFile(args.compare, 'utf-8'))
        printComparison(summary, baseline.summary, 'Cold Load Comparison')
        if (baseline.warmSummary) {
          printComparison(warmSummary, baseline.warmSummary, 'Warm Startpage Comparison')
        }
      } catch (err) {
        console.error(`\nCould not load baseline: ${err.message}`)
      }
    }
    console.log('')
  } finally {
    await browser.close()
    if (standalone) await standalone.close()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
