#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import puppeteer from 'puppeteer'

const { values: args } = parseArgs({
  options: {
    url:      { type: 'string',  default: 'http://localhost:5173' },
    runs:     { type: 'string',  default: '5' },
    json:     { type: 'string' },
    compare:  { type: 'string' },
    user:     { type: 'string',  default: 'admin' },
    password: { type: 'string',  default: 'admin' },
  }
})

const BASE_URL = args.url
const RUNS = parseInt(args.runs, 10)
const API_BASE = `${BASE_URL}/api`

async function authenticate(browser) {
  const page = await browser.newPage()
  const res = await page.evaluate(async (apiBase, user, pass) => {
    const r = await fetch(`${apiBase}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username: user, password: pass })
    })
    return { ok: r.ok, status: r.status }
  }, API_BASE, args.user, args.password)

  if (!res.ok) {
    console.error(`Authentication failed (HTTP ${res.status}). Check --user and --password.`)
    process.exit(1)
  }

  const cookies = await page.cookies()
  await page.close()
  return cookies
}

async function runSingle(browser, cookies, runIndex) {
  const page = await browser.newPage()
  await page.setCookie(...cookies)
  await page.setCacheEnabled(false)

  const transferSizes = { js: 0, css: 0, image: 0, other: 0, total: 0 }
  page.on('response', res => {
    const ct = res.headers()['content-type'] ?? ''
    const cl = parseInt(res.headers()['content-length'] ?? '0', 10)
    if (ct.includes('javascript')) transferSizes.js += cl
    else if (ct.includes('css')) transferSizes.css += cl
    else if (ct.includes('image')) transferSizes.image += cl
    else transferSizes.other += cl
    transferSizes.total += cl
  })

  await page.evaluateOnNewDocument(() => {
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
  })

  const start = performance.now()
  await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 30_000 })
  const loadTime = performance.now() - start

  await page.waitForFunction(() => {
    return document.querySelector('.widget-grid') || document.querySelector('.login-card')
  }, { timeout: 15_000 })

  await new Promise(r => setTimeout(r, 500))

  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0]
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]
    const longTasks = window.__LONG_TASKS__ || []
    const tbt = longTasks.reduce((sum, d) => sum + Math.max(0, d - 50), 0)

    return {
      ttfb: nav?.responseStart ?? 0,
      fcp: fcp?.startTime ?? 0,
      lcp: window.__LCP__ ?? 0,
      tbt,
      domContentLoaded: nav?.domContentLoadedEventEnd ?? 0,
      loadEvent: nav?.loadEventEnd ?? 0,
    }
  })

  await page.close()

  return { ...metrics, loadTime: Math.round(loadTime), transferSizes }
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

  const lastTransfer = results[results.length - 1].transferSizes
  summary.transferKB = {
    js: Math.round(lastTransfer.js / 1024),
    css: Math.round(lastTransfer.css / 1024),
    image: Math.round(lastTransfer.image / 1024),
    total: Math.round(lastTransfer.total / 1024),
  }
  return summary
}

function printTable(summary, label = 'Results') {
  console.log(`\n── ${label} (${'─'.repeat(40)})`)
  console.log('')
  console.log('  Metric              Avg      Min      p50      p95      Max')
  console.log('  ─────────────────── ──────── ──────── ──────── ──────── ────────')
  for (const [key, vals] of Object.entries(summary)) {
    if (key === 'transferKB') continue
    const { avg, min, p50, p95, max } = vals
    const pad = s => String(s).padStart(6) + 'ms'
    console.log(`  ${key.padEnd(20)} ${pad(avg)}  ${pad(min)}  ${pad(p50)}  ${pad(p95)}  ${pad(max)}`)
  }
  console.log('')
  const t = summary.transferKB
  console.log(`  Transfer sizes: JS=${t.js}KB  CSS=${t.css}KB  Image=${t.image}KB  Total=${t.total}KB`)
}

function printComparison(current, baseline) {
  console.log('\n── Comparison ─────────────────────────────────────')
  console.log('')
  console.log('  Metric              Baseline    Current     Delta')
  console.log('  ─────────────────── ────────── ────────── ──────────')
  for (const key of Object.keys(current)) {
    if (key === 'transferKB') continue
    const bAvg = baseline[key]?.avg ?? 0
    const cAvg = current[key].avg
    const delta = cAvg - bAvg
    const pct = bAvg ? ((delta / bAvg) * 100).toFixed(1) : 'N/A'
    const sign = delta <= 0 ? '' : '+'
    const marker = delta < 0 ? ' ✓' : delta > 0 ? ' ✗' : ''
    console.log(`  ${key.padEnd(20)} ${String(bAvg).padStart(6)}ms   ${String(cAvg).padStart(6)}ms   ${sign}${delta}ms (${sign}${pct}%)${marker}`)
  }

  if (baseline.transferKB && current.transferKB) {
    console.log('')
    for (const k of ['js', 'css', 'image', 'total']) {
      const b = baseline.transferKB[k] ?? 0
      const c = current.transferKB[k]
      const d = c - b
      const sign = d <= 0 ? '' : '+'
      console.log(`  Transfer ${k.padEnd(7)} ${String(b).padStart(6)}KB   ${String(c).padStart(6)}KB   ${sign}${d}KB`)
    }
  }
}

async function main() {
  console.log(`HomeDash Performance Benchmark`)
  console.log(`URL: ${BASE_URL}  |  Runs: ${RUNS}`)
  console.log('')

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  })

  console.log('Authenticating...')
  const cookies = await authenticate(browser)
  console.log('Authenticated. Starting benchmark runs...\n')

  const results = []
  for (let i = 0; i < RUNS; i++) {
    process.stdout.write(`  Run ${i + 1}/${RUNS}...`)
    const result = await runSingle(browser, cookies, i)
    results.push(result)
    console.log(` FCP=${result.fcp.toFixed(0)}ms  LCP=${result.lcp.toFixed(0)}ms  TBT=${result.tbt.toFixed(0)}ms`)
  }

  await browser.close()

  const summary = summarize(results)
  printTable(summary, `Benchmark (${RUNS} runs)`)

  if (args.json) {
    const output = { timestamp: new Date().toISOString(), url: BASE_URL, runs: RUNS, summary, raw: results }
    await writeFile(args.json, JSON.stringify(output, null, 2))
    console.log(`\nSaved to ${args.json}`)
  }

  if (args.compare) {
    try {
      const baseline = JSON.parse(await readFile(args.compare, 'utf-8'))
      printComparison(summary, baseline.summary)
    } catch (err) {
      console.error(`\nCould not load baseline: ${err.message}`)
    }
  }

  console.log('')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
