import * as React from 'react'
import type { WidgetRenderProps } from './types'

export function State({ state, message }: { state: WidgetRenderProps['state']; message?: string }) {
  if (state === 'loading') return <p className="widget-status">Loading data…</p>
  if (state === 'offline') return <p className="widget-status"><i className="status-lamp offline"/>Connection unavailable{message ? ` · ${message}` : ''}</p>
  if (state === 'error') return <p className="widget-status">This widget couldn&apos;t load.</p>
  if (state === 'stale') return <p className="widget-status"><i className="status-lamp stale"/>Showing latest available data</p>
  return null
}

const FAVICON_API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'
const PUBLIC_HOST_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i
const PRIVATE_TLD_RE = /\.(local|lan|internal|home|arpa|localhost)$/i

function isPublicHostname(domain: string): boolean {
  return Boolean(domain) && domain !== 'localhost' && PUBLIC_HOST_RE.test(domain) && !PRIVATE_TLD_RE.test(domain)
}

export function BookmarkFavicon({ url, icon, name }: { url: string; icon?: string; name: string }) {
  const [failedState, setFailedState] = React.useState<{ key: string; step: number }>({ key: '', step: 0 })
  const trimmedIcon = (icon ?? '').trim()
  const stateKey = `${url}|${trimmedIcon}`
  const step = failedState.key === stateKey ? failedState.step : 0

  if (trimmedIcon && (trimmedIcon.startsWith('http://') || trimmedIcon.startsWith('https://') || trimmedIcon.startsWith('data:') || trimmedIcon.startsWith('/'))) {
    if (step === 0) {
      return (
        <span className="bookmark-icon custom-img-wrapper">
          <img
            src={trimmedIcon}
            alt=""
            width={32}
            height={32}
            loading="lazy"
            decoding="async"
            onError={() => setFailedState({ key: stateKey, step: 1 })}
            className="bookmark-favicon-img"
          />
        </span>
      )
    }
  }

  if (trimmedIcon && !trimmedIcon.startsWith('http://') && !trimmedIcon.startsWith('https://') && !trimmedIcon.startsWith('data:') && !trimmedIcon.startsWith('/')) {
    return <span className="bookmark-icon custom-emoji">{trimmedIcon}</span>
  }

  let domain = ''
  let origin = ''
  try {
    const parsed = new URL(url)
    domain = parsed.hostname.toLowerCase()
    origin = parsed.origin
  } catch {
    domain = ''
    origin = ''
  }

  const candidates = domain
    ? isPublicHostname(domain)
      ? [
          `${FAVICON_API_BASE}/v1/favicons?domain=${encodeURIComponent(domain)}`,
          `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`,
          ...(origin ? [`${origin}/favicon.ico`] : [])
        ]
      : origin
        ? [`${origin}/favicon.ico`]
        : []
    : []

  const activeSrc = candidates[step]
  if (activeSrc) {
    return (
      <span className="bookmark-icon favicon-wrapper">
        <img
          src={activeSrc}
          alt=""
          width={32}
          height={32}
          loading="lazy"
          decoding="async"
          onError={() => setFailedState({ key: stateKey, step: step + 1 })}
          className="bookmark-favicon-img"
        />
      </span>
    )
  }

  return <span className="bookmark-icon fallback-letter">{(name || 'B').slice(0, 1).toUpperCase()}</span>
}

export function RadialGauge({ label, percent, detail, color = '#6ea8ff', compact = false }: { label: string; percent: number | null; detail?: string; color?: string; compact?: boolean }) {
  const radius = compact ? 27 : 38
  const stroke = compact ? 4.5 : 6
  const normalizedRadius = radius - stroke * 2
  const circumference = normalizedRadius * 2 * Math.PI
  const numericPercent = percent === null ? 0 : Math.min(100, Math.max(0, percent))
  const strokeDashoffset = circumference - (numericPercent / 100) * circumference

  let statusColor = percent === null ? 'rgba(255, 255, 255, 0.25)' : color
  if (percent !== null && percent >= 85) statusColor = '#f08282'
  else if (percent !== null && percent >= 70) statusColor = '#f2c276'

  return (
    <div className={`radial-gauge-item${compact ? ' compact' : ''}`} title={`${label}: ${percent === null ? 'N/A' : `${percent}%`}${detail ? ` (${detail})` : ''}`}>
      <div className="radial-gauge-svg-wrap">
        <svg height={radius * 2} width={radius * 2} className="radial-gauge-svg">
          <circle
            stroke="rgba(255, 255, 255, 0.12)"
            fill="transparent"
            strokeWidth={stroke}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          <circle
            stroke={statusColor}
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={`${circumference} ${circumference}`}
            style={{ strokeDashoffset }}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            className="radial-gauge-progress"
          />
        </svg>
        <div className="radial-gauge-center">
          <strong>{percent === null ? '—' : `${percent}%`}</strong>
        </div>
      </div>
      <span className="radial-gauge-label">{label}</span>
      {detail && <small className="radial-gauge-detail">{detail}</small>}
    </div>
  )
}

export function MiniSparkline({ data, stroke = '#6ea8ff', fill = 'rgba(110, 168, 255, 0.15)', height = 48 }: { data: number[]; stroke?: string; fill?: string; height?: number }) {
  if (!data || data.length < 2) return null
  const min = 0
  const max = 100
  const width = 240
  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * width
    const y = height - ((Math.min(max, Math.max(min, val)) - min) / (max - min)) * (height - 6) - 3
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const polylineStr = points.join(' ')
  const polygonStr = `0,${height} ${polylineStr} ${width},${height}`

  return (
    <div className="sparkline-container" style={{ height }}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="sparkline-svg">
        <polygon points={polygonStr} fill={fill}/>
        <polyline points={polylineStr} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  )
}
