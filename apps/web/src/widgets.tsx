import * as React from 'react'
import type { Bookmark, DashboardNotification, PerformanceSnapshot, Service } from './api'

export type WidgetData = {
  services: Service[]
  notifications: DashboardNotification[]
  unreadNotifications: number
  bookmarks: Bookmark[]
  performance: PerformanceSnapshot | null
}

export type WidgetRenderProps = {
  data: WidgetData
  state: 'loading' | 'ready' | 'empty' | 'offline' | 'stale' | 'error'
  message?: string
  editing?: boolean
  configuration?: Record<string, unknown>
  onConfigurationChange?: (configuration: Record<string, unknown>) => void
  onBookmarkChange?: () => void
  onBookmarkDelete?: (bookmark: Bookmark) => void
  onBookmarkEdit?: (bookmark: Bookmark) => void
}

export type WidgetDefinition = {
  type: string
  version: number
  defaultSize: { width: number; height: number }
  minSize: { width: number; height: number }
  configuration: Record<string, unknown>
  render: (props: WidgetRenderProps) => React.ReactNode
}

function State({ state, message }: { state: WidgetRenderProps['state']; message?: string }) {
  if (state === 'loading') return <p className="widget-status">Loading data…</p>
  if (state === 'offline') return <p className="widget-status"><i className="status-lamp offline"/>Connection unavailable{message ? ` · ${message}` : ''}</p>
  if (state === 'error') return <p className="widget-status">This widget couldn't load.</p>
  if (state === 'stale') return <p className="widget-status"><i className="status-lamp stale"/>Showing latest available data</p>
  return null
}

/* =========================================================================
   SEARCH WIDGET & PROVIDERS
   ========================================================================= */

type SearchProviderKey = 'google' | 'duckduckgo' | 'bing' | 'brave' | 'github' | 'youtube'

type SearchProviderDef = {
  label: string
  url: string
  icon: React.ReactNode
}

const SEARCH_PROVIDERS: Record<SearchProviderKey, SearchProviderDef> = {
  google: {
    label: 'Google',
    url: 'https://www.google.com/search?q=',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="engine-svg">
        <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"/>
        <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z"/>
        <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12c0 1.96.45 3.82 1.25 5.42l4.03-3.15Z"/>
        <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"/>
      </svg>
    )
  },
  duckduckgo: {
    label: 'DuckDuckGo',
    url: 'https://duckduckgo.com/?q=',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="engine-svg">
        <circle cx="12" cy="12" r="10" fill="#DE5833"/>
        <path fill="#FFF" d="M17.5 13.5c-.4 1.8-2 3.1-4 3.1-1.3 0-2.4-.6-3.1-1.5-.4-.5-.9-.6-1.5-.3-.7.3-1.2 1-1.2 1.8 0 .8.6 1.5 1.4 1.7 1.4.3 2.9.5 4.4.5 4.1 0 7.5-3.4 7.5-7.5 0-.4 0-.8-.1-1.2-.4.6-1.5 1-2.4 1.2-.4.1-.8.6-1 1.2Z"/>
        <circle cx="10" cy="10" r="1.5" fill="#FFF"/>
      </svg>
    )
  },
  bing: {
    label: 'Bing',
    url: 'https://www.bing.com/search?q=',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="engine-svg">
        <path fill="#008373" d="m5 3 4.5 1.5v12.7l6.5-3.7-3.2-1.6 4.7-4.9h-8L5 3Z"/>
        <path fill="#00A4EF" d="m16 13.5-6.5 3.7v3.8l9.5-5.5-3-2Z"/>
      </svg>
    )
  },
  brave: {
    label: 'Brave',
    url: 'https://search.brave.com/search?q=',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="engine-svg">
        <path fill="#FB542B" d="M12 2 3 5.5v6.2c0 5.4 3.8 10.4 9 11.8 5.2-1.4 9-6.4 9-11.8V5.5L12 2Zm5.5 10.2-2.1 1.8.6 2.8-2.5-1.5-2.5 1.5.6-2.8-2.1-1.8 2.8-.3 1.2-2.6 1.2 2.6 2.8.3Z"/>
      </svg>
    )
  },
  github: {
    label: 'GitHub',
    url: 'https://github.com/search?q=',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="engine-svg">
        <path fill="#FFF" fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z"/>
      </svg>
    )
  },
  youtube: {
    label: 'YouTube',
    url: 'https://www.youtube.com/results?search_query=',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="engine-svg">
        <path fill="#FF0000" d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814Z"/>
        <path fill="#FFF" d="m9.545 15.568 6.273-3.568-6.273-3.568v7.136Z"/>
      </svg>
    )
  }
}

function SearchWidget({ configuration }: WidgetRenderProps) {
  const [query, setQuery] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  const providerKey = (String(configuration?.provider ?? 'google') as SearchProviderKey)
  const provider = SEARCH_PROVIDERS[providerKey] ?? SEARCH_PROVIDERS.google
  const searchStyle = String(configuration?.searchStyle ?? 'pill')
  const isCompact = searchStyle === 'compact' || searchStyle === 'minimal'
  const showEngineIcon = configuration?.showEngineIcon !== false && !isCompact

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const value = query.trim()
    if (!value) return
    const target = configuration?.openInNewTab === false ? '_self' : '_blank'
    window.open(`${provider.url}${encodeURIComponent(value)}`, target, 'noopener,noreferrer')
  }

  if (isCompact) {
    return (
      <form className={`widget-card search-widget style-compact ${searchStyle}`} onSubmit={submit} role="search">
        <svg className="search-leading-icon" aria-hidden="true" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="7"/>
          <path d="m20 20-4-4"/>
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder={`Search ${provider.label}…`}
          aria-label={`Search with ${provider.label}`}
        />
      </form>
    )
  }

  return (
    <form className={`widget-card search-widget style-${searchStyle}`} onSubmit={submit} role="search">
      {showEngineIcon ? (
        <span className="search-provider-badge" title={`Search with ${provider.label}`}>
          {provider.icon}
        </span>
      ) : (
        <svg className="search-leading-icon" aria-hidden="true" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="7"/>
          <path d="m20 20-4-4"/>
        </svg>
      )}
      <input
        ref={inputRef}
        value={query}
        onChange={event => setQuery(event.target.value)}
        placeholder={`Search with ${provider.label}…`}
        aria-label={`Search with ${provider.label}`}
      />
      <kbd className="search-shortcut">Ctrl K</kbd>
      <button type="submit" className="search-submit-button" aria-label="Search">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12h14M13 6l6 6-6 6"/>
        </svg>
      </button>
    </form>
  )
}

/* =========================================================================
   BOOKMARKS WIDGET (STYLES: icons-only, tiles, compact-chips, dock)
   ========================================================================= */

function BookmarkFavicon({ url, icon, name }: { url: string; icon?: string; name: string }) {
  const [failed, setFailed] = React.useState(false)
  let domain = ''
  try {
    domain = new URL(url).hostname
  } catch {
    domain = ''
  }
  const faviconUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : ''

  if (icon && icon.length <= 4) {
    return <span className="bookmark-icon custom-emoji">{icon}</span>
  }
  if (!failed && faviconUrl) {
    return (
      <span className="bookmark-icon favicon-wrapper">
        <img
          src={faviconUrl}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="bookmark-favicon-img"
        />
      </span>
    )
  }
  return <span className="bookmark-icon fallback-letter">{name.slice(0, 1).toUpperCase()}</span>
}

function BookmarksWidget({ data, state, editing, configuration, onBookmarkChange, onBookmarkDelete, onBookmarkEdit }: WidgetRenderProps) {
  const bookmarkStyle = String(configuration?.bookmarkStyle ?? 'tiles')
  const iconSize = String(configuration?.iconSize ?? 'normal')
  const categoryFilter = String(configuration?.categoryFilter ?? 'all')

  const bookmarksToRender = categoryFilter === 'all'
    ? data.bookmarks
    : data.bookmarks.filter(b => (b.category || '').toLowerCase() === categoryFilter.toLowerCase())

  return (
    <section className={`widget-card bookmarks-widget style-${bookmarkStyle} size-${iconSize}`}>
      {editing && (
        <div className="bookmarks-edit-header">
          <button className="mini-action add-bookmark-btn" onClick={onBookmarkChange}>＋ Add link</button>
        </div>
      )}
      <State state={state}/>
      {state === 'ready' && !bookmarksToRender.length && (
        <p className="widget-empty">
          {categoryFilter !== 'all' ? `No bookmarks in category "${categoryFilter}".` : 'No bookmarks saved yet. Add your favorite links.'}
        </p>
      )}
      {state === 'ready' && bookmarksToRender.length > 0 && (
        <div className={`bookmark-layout ${bookmarkStyle}`}>
          {bookmarksToRender.map(bookmark => {
            let host = ''
            try { host = new URL(bookmark.url).hostname } catch { host = '' }

            if (bookmarkStyle === 'icons-only') {
              return (
                <div className="bookmark-item icon-only-item" key={bookmark.id}>
                  <a href={bookmark.url} target="_blank" rel="noreferrer" className="bookmark-icon-anchor" title={bookmark.name}>
                    <BookmarkFavicon url={bookmark.url} icon={bookmark.icon} name={bookmark.name}/>
                    <span className="bookmark-floating-tooltip">{bookmark.name}</span>
                  </a>
                  {editing && (
                    <div className="bookmark-edit-actions">
                      <button onClick={() => onBookmarkEdit?.(bookmark)} aria-label="Edit">✎</button>
                      <button onClick={() => onBookmarkDelete?.(bookmark)} aria-label="Delete">×</button>
                    </div>
                  )}
                </div>
              )
            }

            if (bookmarkStyle === 'compact-chips') {
              return (
                <div className="bookmark-item chip-item" key={bookmark.id}>
                  <a href={bookmark.url} target="_blank" rel="noreferrer" className="bookmark-chip-anchor">
                    <BookmarkFavicon url={bookmark.url} icon={bookmark.icon} name={bookmark.name}/>
                    <span className="bookmark-chip-title">{bookmark.name}</span>
                  </a>
                  {editing && (
                    <div className="bookmark-edit-actions">
                      <button onClick={() => onBookmarkEdit?.(bookmark)} aria-label="Edit">✎</button>
                      <button onClick={() => onBookmarkDelete?.(bookmark)} aria-label="Delete">×</button>
                    </div>
                  )}
                </div>
              )
            }

            if (bookmarkStyle === 'dock') {
              return (
                <div className="bookmark-item dock-item" key={bookmark.id}>
                  <a href={bookmark.url} target="_blank" rel="noreferrer" className="bookmark-dock-anchor" title={bookmark.name}>
                    <BookmarkFavicon url={bookmark.url} icon={bookmark.icon} name={bookmark.name}/>
                    <span className="bookmark-dock-label">{bookmark.name}</span>
                  </a>
                  {editing && (
                    <div className="bookmark-edit-actions">
                      <button onClick={() => onBookmarkEdit?.(bookmark)} aria-label="Edit">✎</button>
                      <button onClick={() => onBookmarkDelete?.(bookmark)} aria-label="Delete">×</button>
                    </div>
                  )}
                </div>
              )
            }

            // Default: 'tiles'
            return (
              <div className="bookmark-tile" key={bookmark.id}>
                <a href={bookmark.url} target="_blank" rel="noreferrer">
                  <BookmarkFavicon url={bookmark.url} icon={bookmark.icon} name={bookmark.name}/>
                  <span className="bookmark-copy">
                    <strong>{bookmark.name}</strong>
                    <small>{bookmark.category ?? host}</small>
                  </span>
                  <b aria-hidden="true" className="tile-arrow">↗</b>
                </a>
                {editing && (
                  <div className="bookmark-edit-actions">
                    <button onClick={() => onBookmarkEdit?.(bookmark)} aria-label="Edit">✎</button>
                    <button onClick={() => onBookmarkDelete?.(bookmark)} aria-label="Delete">×</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

/* =========================================================================
   NOTIFICATIONS WIDGET (STYLES: cards, timeline, compact-ticker, badge-only)
   ========================================================================= */

function formatRelativeTime(dateString: string): string {
  try {
    const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
    if (diff < 60) return 'Just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

function NotificationsWidget({ data, state, message, configuration }: WidgetRenderProps) {
  const notificationStyle = String(configuration?.notificationStyle ?? 'cards')
  const maxItems = Number(configuration?.maxItems ?? 6)
  const items = data.notifications.slice(0, maxItems)

  return (
    <section className={`widget-card notifications-widget style-${notificationStyle}`}>
      <State state={state} message={message}/>

      {state === 'ready' && !data.notifications.length && (
        <div className="notifications-empty-state">
          <span className="empty-bell-icon">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/>
              <path d="M10 21h4"/>
            </svg>
          </span>
          <p>You're all caught up</p>
          <small>No unread notifications right now</small>
        </div>
      )}

      {state === 'ready' && data.notifications.length > 0 && (
        <>
          {notificationStyle === 'badge-only' && (
            <div className="notifications-badge-hero">
              <div className="badge-glow-circle">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/>
                  <path d="M10 21h4"/>
                </svg>
                {data.unreadNotifications > 0 && (
                  <span className="unread-dot-pulse"/>
                )}
              </div>
              <div className="badge-hero-count">{data.unreadNotifications}</div>
              <div className="badge-hero-label">Unread notifications</div>
            </div>
          )}

          {notificationStyle === 'compact-ticker' && (
            <div className="notifications-ticker-view">
              <div className="ticker-top">
                <span className="ticker-pill">{data.unreadNotifications} unread</span>
                <span className="ticker-time">{items[0] ? formatRelativeTime(items[0].createdAt) : ''}</span>
              </div>
              {items[0] && (
                <div className={`ticker-headline level-${items[0].level.toLowerCase()}`}>
                  <span className="ticker-indicator"/>
                  <strong>{items[0].title}</strong>
                  <p>{items[0].body}</p>
                </div>
              )}
            </div>
          )}

          {notificationStyle === 'timeline' && (
            <div className="notifications-timeline">
              <div className="timeline-header">
                <span className="count-chip">{data.unreadNotifications} unread</span>
              </div>
              <div className="timeline-stream">
                {items.map(notification => (
                  <div className={`timeline-entry level-${notification.level.toLowerCase()}`} key={notification.id}>
                    <div className="timeline-bullet"/>
                    <div className="timeline-body">
                      <div className="timeline-meta">
                        <span className="timeline-source">{notification.source}</span>
                        <time>{formatRelativeTime(notification.createdAt)}</time>
                      </div>
                      <strong className="timeline-title">{notification.title}</strong>
                      <p className="timeline-desc">{notification.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {notificationStyle === 'cards' && (
            <div className="notifications-cards-view">
              <div className="notifications-head-row">
                <span className="count-chip">{data.unreadNotifications} unread</span>
              </div>
              <div className="notification-cards-list">
                {items.map(notification => (
                  <article className={`glass-notification-card level-${notification.level.toLowerCase()}`} key={notification.id}>
                    <div className="notif-card-header">
                      <span className={`notif-status-badge level-${notification.level.toLowerCase()}`}>
                        {notification.level}
                      </span>
                      <time>{formatRelativeTime(notification.createdAt)}</time>
                    </div>
                    <strong className="notif-card-title">{notification.title}</strong>
                    <p className="notif-card-body">{notification.body}</p>
                    <div className="notif-card-footer">
                      <small>{notification.source}</small>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}

/* =========================================================================
   PERFORMANCE & HARDWARE METRICS WIDGET (STYLES: radial-gauges, time-series-graph, kpi-stats, horizontal-bars)
   ========================================================================= */

function RadialGauge({ label, percent, detail, color = '#6ea8ff' }: { label: string; percent: number; detail?: string; color?: string }) {
  const radius = 38
  const stroke = 6
  const normalizedRadius = radius - stroke * 2
  const circumference = normalizedRadius * 2 * Math.PI
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference

  let statusColor = color
  if (percent >= 85) statusColor = '#f08282'
  else if (percent >= 70) statusColor = '#f2c276'

  return (
    <div className="radial-gauge-item" title={`${label}: ${percent}% (${detail || ''})`}>
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
          <strong>{percent}%</strong>
        </div>
      </div>
      <span className="radial-gauge-label">{label}</span>
      {detail && <small className="radial-gauge-detail">{detail}</small>}
    </div>
  )
}

function MiniSparkline({ data, stroke = '#6ea8ff', fill = 'rgba(110, 168, 255, 0.15)', height = 48 }: { data: number[]; stroke?: string; fill?: string; height?: number }) {
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

function PerformanceWidget({ data, state, message, configuration }: WidgetRenderProps) {
  const metrics = data.performance?.metrics ?? []
  const history = data.performance?.history ?? []
  const perfStyle = String(configuration?.perfStyle ?? 'radial-gauges')

  const cpu = metrics.find(m => m.key === 'cpu')
  const ram = metrics.find(m => m.key === 'ram')
  const gpu = metrics.find(m => m.key === 'gpu')
  const disk = metrics.find(m => m.key === 'storage')

  const cpuPercent = cpu?.value ?? 0
  const ramPercent = ram?.value ?? 0
  const gpuPercent = gpu?.value ?? 0

  const cpuHistory = history.map(h => h.cpu ?? 0)

  return (
    <section className={`widget-card performance-widget style-${perfStyle}`}>
      <State state={state} message={message}/>

      {state === 'ready' && (
        <>
          {/* Style 1: Radial Gauges (Circular dials) */}
          {perfStyle === 'radial-gauges' && (
            <div className="perf-radial-grid">
              <RadialGauge label="CPU" percent={cpuPercent} detail={cpu?.detail} color="#6ea8ff"/>
              <RadialGauge label="RAM" percent={ramPercent} detail={ram?.detail} color="#93d7a1"/>
              <RadialGauge label="GPU" percent={gpuPercent} detail={gpu?.detail} color="#d4a3ff"/>
            </div>
          )}

          {/* Style 2: Time Series Chart / Graph */}
          {perfStyle === 'time-series-graph' && (
            <div className="perf-timeseries-view">
              <div className="timeseries-legend">
                <span className="legend-item cpu-legend">
                  <i/> CPU: <strong>{cpuPercent}%</strong>
                </span>
                <span className="legend-item ram-legend">
                  <i/> RAM: <strong>{ramPercent}%</strong>
                </span>
                {gpu && (
                  <span className="legend-item gpu-legend">
                    <i/> GPU: <strong>{gpuPercent}%</strong>
                  </span>
                )}
              </div>
              <div className="timeseries-chart-box">
                <MiniSparkline data={cpuHistory} stroke="#6ea8ff" fill="rgba(110, 168, 255, 0.2)" height={80}/>
              </div>
              <div className="timeseries-footer">
                <small>Host Activity · Real-time streaming</small>
                {disk && <small>{disk.label}: {disk.detail}</small>}
              </div>
            </div>
          )}

          {/* Style 3: Minimal KPI Stat Tiles (Ideal for 1x1 or 2x1) */}
          {perfStyle === 'kpi-stats' && (
            <div className="perf-kpi-grid">
              <div className="kpi-stat-card">
                <span className="kpi-label">CPU</span>
                <span className={`kpi-value ${cpuPercent > 80 ? 'warn' : ''}`}>{cpuPercent}%</span>
              </div>
              <div className="kpi-stat-card">
                <span className="kpi-label">RAM</span>
                <span className={`kpi-value ${ramPercent > 80 ? 'warn' : ''}`}>{ramPercent}%</span>
              </div>
              <div className="kpi-stat-card">
                <span className="kpi-label">GPU</span>
                <span className="kpi-value">{gpuPercent}%</span>
              </div>
            </div>
          )}

          {/* Style 4: Classic Horizontal Glass Meter Bars */}
          {perfStyle === 'horizontal-bars' && (
            <div className="metrics-list">
              {metrics.map(metric => {
                const val = metric.value ?? 0
                return (
                  <div className="metric-row" key={metric.key}>
                    <div className="metric-label">
                      <span>{metric.label}</span>
                      <strong>{metric.detail ? `${metric.detail} · ` : ''}{val}%</strong>
                    </div>
                    <div className="metric-track">
                      <span
                        style={{
                          width: `${Math.min(100, Math.max(0, val))}%`,
                          background: val > 85 ? 'linear-gradient(90deg, #f2c276, #f08282)' : undefined
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </section>
  )
}

function ServicesWidget({ data, state }: WidgetRenderProps) {
  return (
    <section className="widget-card services-widget">
      <State state={state}/>
      {state === 'ready' && (
        <div className="service-list">
          {data.services.map(service => (
            <div className="service-item" key={service.id ?? service.name}>
              <i className={`status-lamp ${service.status}`}/>
              <span>{service.name}</span>
              <small>{service.status}</small>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/* =========================================================================
   REGISTRY
   ========================================================================= */

export const widgetRegistry: Record<string, WidgetDefinition> = {
  search: {
    type: 'search',
    version: 1,
    defaultSize: { width: 4, height: 1 },
    minSize: { width: 1, height: 1 },
    configuration: { provider: 'google', searchStyle: 'pill', openInNewTab: true, showEngineIcon: true },
    render: SearchWidget
  },
  'search-compact': {
    type: 'search-compact',
    version: 1,
    defaultSize: { width: 2, height: 1 },
    minSize: { width: 1, height: 1 },
    configuration: { provider: 'google', searchStyle: 'compact', openInNewTab: true, showEngineIcon: true },
    render: SearchWidget
  },
  bookmarks: {
    type: 'bookmarks',
    version: 1,
    defaultSize: { width: 3, height: 2 },
    minSize: { width: 1, height: 1 },
    configuration: { bookmarkStyle: 'tiles', iconSize: 'normal' },
    render: BookmarksWidget
  },
  'bookmarks-icons': {
    type: 'bookmarks-icons',
    version: 1,
    defaultSize: { width: 2, height: 2 },
    minSize: { width: 1, height: 1 },
    configuration: { bookmarkStyle: 'icons-only', iconSize: 'normal' },
    render: BookmarksWidget
  },
  'bookmarks-dock': {
    type: 'bookmarks-dock',
    version: 1,
    defaultSize: { width: 4, height: 1 },
    minSize: { width: 1, height: 1 },
    configuration: { bookmarkStyle: 'dock', iconSize: 'normal' },
    render: BookmarksWidget
  },
  notifications: {
    type: 'notifications',
    version: 1,
    defaultSize: { width: 3, height: 3 },
    minSize: { width: 1, height: 1 },
    configuration: { notificationStyle: 'cards', maxItems: 6 },
    render: NotificationsWidget
  },
  'notifications-badge': {
    type: 'notifications-badge',
    version: 1,
    defaultSize: { width: 1, height: 1 },
    minSize: { width: 1, height: 1 },
    configuration: { notificationStyle: 'badge-only' },
    render: NotificationsWidget
  },
  'notifications-ticker': {
    type: 'notifications-ticker',
    version: 1,
    defaultSize: { width: 3, height: 1 },
    minSize: { width: 1, height: 1 },
    configuration: { notificationStyle: 'compact-ticker' },
    render: NotificationsWidget
  },
  'homelab-performance': {
    type: 'homelab-performance',
    version: 1,
    defaultSize: { width: 3, height: 2 },
    minSize: { width: 1, height: 1 },
    configuration: { perfStyle: 'radial-gauges' },
    render: PerformanceWidget
  },
  'performance-graph': {
    type: 'performance-graph',
    version: 1,
    defaultSize: { width: 4, height: 2 },
    minSize: { width: 1, height: 1 },
    configuration: { perfStyle: 'time-series-graph' },
    render: PerformanceWidget
  },
  'performance-kpi': {
    type: 'performance-kpi',
    version: 1,
    defaultSize: { width: 2, height: 1 },
    minSize: { width: 1, height: 1 },
    configuration: { perfStyle: 'kpi-stats' },
    render: PerformanceWidget
  },
  'service-status': {
    type: 'service-status',
    version: 1,
    defaultSize: { width: 3, height: 2 },
    minSize: { width: 1, height: 1 },
    configuration: {},
    render: ServicesWidget
  }
}
