import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, PointerEvent, ReactNode } from 'react'
import {
  ApiError,
  consumeInitialBootstrap,
  createBookmark,
  createWidget,
  deleteBookmark,
  deleteWidget,
  fetchBootstrap,
  fetchDashboard,
  fetchPerformance,
  fetchWidgetDefinitions,
  login,
  logout,
  openEvents,
  updateBookmark,
  updateWidget,
  type AuthUser,
  type Bookmark,
  type BootstrapPayload,
  type DashboardProfile,
  type DashboardSnapshot,
  type GridLayout,
  type PerformanceSnapshot,
  type Widget,
  type WidgetDefinition as ApiWidgetDefinition
} from './api'
import { findOpenLayout, GRID_COLUMNS, GRID_ROWS, moveWidget } from './grid'
import { BookmarkFavicon, widgetRegistry, type WidgetData, type WidgetRenderProps } from './widgets'
import './App.css'

type ToastState = 'saved' | 'saving' | 'error'
type IconName = 'grid' | 'edit' | 'check' | 'plus' | 'search' | 'settings' | 'move' | 'resize' | 'remove' | 'close' | 'arrow' | 'bookmark' | 'bell' | 'activity' | 'logout' | 'gear'

function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4Z"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    plus: <path d="M12 5v14M5 12h14"/>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.1.9-1.1 1.9-1.3-.5a8 8 0 0 1-1.6.9l-.2 1.4h-2.2l-.2-1.4a8 8 0 0 1-1.7-.9l-1.3.5-1.1-1.9 1.1-.9a7 7 0 0 1 0-1.9l-1.1-.9 1.1-1.9 1.3.5a8 8 0 0 1 1.7-.9l.2-1.4h2.2l.2 1.4a8 8 0 0 1 1.6.9l1.3-.5 1.1 1.9-1.1.9a7 7 0 0 1-.1 1.8Z"/></>,
    move: <><path d="M12 2v20M2 12h20M12 2l-3 3m3-3 3 3M12 22l-3-3m3 3 3-3M2 12l3-3m-3 3 3 3M22 12l-3-3m3 3-3 3"/></>,
    resize: <><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3M21 16v3a2 2 0 0 1-2 2h-3"/></>,
    remove: <><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6"/></>,
    close: <path d="m18 6-12 12M6 6l12 12"/>,
    arrow: <><path d="M7 17 17 7M7 7h10v10"/></>,
    bookmark: <path d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18l-6-4-6 4z"/>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    activity: <path d="M3 12h4l3-9 4 18 3-9h4"/>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></>,
    gear: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.7 2.9-.2-.1a1.7 1.7 0 0 0-1.9.2 1.7 1.7 0 0 0-.8 1.5v.3H9v-.3a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.8.2l-.2.1-1.7-2.9.2-.1a1.7 1.7 0 0 0 .7-1.7 1.7 1.7 0 0 0-1.2-1.3l-.3-.1v-3.4l.3-.1a1.7 1.7 0 0 0 1.2-1.3 1.7 1.7 0 0 0-.7-1.7l-.2-.1 1.7-2.9.2.1a1.7 1.7 0 0 0 1.8.2A1.7 1.7 0 0 0 9 3.6v-.3h6.2v.3a1.7 1.7 0 0 0 .8 1.5 1.7 1.7 0 0 0 1.9.2l.2-.1 1.7 2.9-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.4 1l.2.1v3.4l-.2.1a1.7 1.7 0 0 0-1.4 1z"/></>
  }
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

function LoginScreen({ onAuthenticated }: { onAuthenticated: (user: AuthUser) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await login(username, password)
      onAuthenticated(result.user)
    } catch {
      setError('Incorrect username or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <form onSubmit={submit} className="login-card">
        <div className="brand-lockup">
          <span className="brand-symbol"><Icon name="grid" size={17}/></span>
          <span>HOMEDASH<small>PRIVATE HOMELAB</small></span>
        </div>
        <p className="kicker">PRIVATE ACCESS</p>
        <h1>Your homelab,<br/>in one place.</h1>
        <p className="subtle">Sign in to open your dashboard.</p>
        <label>Username
          <input autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} required/>
        </label>
        <label>Password
          <input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required/>
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button-primary" disabled={loading}>
          {loading ? 'Checking…' : 'Sign in'}<Icon name="arrow" size={14}/>
        </button>
      </form>
    </main>
  )
}

function BookmarkDialog({ bookmark, profileId, widgetId, nextSortOrder, onClose, onSaved }: { bookmark?: Bookmark; profileId: string; widgetId?: string; nextSortOrder?: number; onClose: () => void; onSaved: (bookmark: Bookmark) => void }) {
  const [name, setName] = useState(bookmark?.name ?? '')
  const [url, setUrl] = useState(bookmark?.url ?? '')
  const [category, setCategory] = useState(bookmark?.category ?? '')
  const [icon, setIcon] = useState(bookmark?.icon ?? '')
  const [error, setError] = useState('')

  const PRESET_EMOJIS = ['🌐', '🚀', '💻', '🏠', '📦', '📊', '⚡', '🔒', '🎬', '🎮', '⚙️', '📁', '🐳', '🛡️', '📈', '🗄️']

  async function submit(event: FormEvent) {
    event.preventDefault()
    try {
      const parsed = new URL(url)
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error()
      const result = bookmark
        ? await updateBookmark(bookmark.id, {
            name,
            url,
            icon: icon.trim() || undefined,
            category: category.trim() || undefined
          })
        : await createBookmark(profileId, {
            name,
            url,
            icon: icon.trim() || undefined,
            category: category.trim() || undefined,
            ...(widgetId ? { widgetId } : {}),
            ...(nextSortOrder !== undefined ? { sortOrder: nextSortOrder } : {})
          })
      onSaved(result)
      onClose()
    } catch {
      setError('Enter a name and a valid http(s) URL.')
    }
  }

  return (
    <div className="overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <form className="dialog bookmark-dialog" onSubmit={submit}>
        <div className="dialog-heading">
          <div>
            <p className="kicker">QUICK ACCESS</p>
            <h2>{bookmark ? 'Edit bookmark' : 'Add bookmark'}</h2>
          </div>
          <button type="button" className="close-button" onClick={onClose} aria-label="Close"><Icon name="close"/></button>
        </div>

        <div className="bookmark-form-body">
          <label>Name
            <input value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Proxmox, GitHub, Home Assistant" required/>
          </label>

          <label>URL
            <input type="url" value={url} onChange={event => setUrl(event.target.value)} placeholder="https://..." required/>
          </label>

          <label>Custom Icon / Emoji (optional)
            <input
              value={icon}
              onChange={event => setIcon(event.target.value)}
              placeholder="Paste emoji (e.g. 🚀) or custom image URL, or leave empty for auto-favicon"
            />
          </label>

          <div className="emoji-quick-picks">
            {PRESET_EMOJIS.map(item => (
              <button
                key={item}
                type="button"
                className={`emoji-pick-btn ${icon === item ? 'selected' : ''}`}
                onClick={() => setIcon(item)}
              >
                {item}
              </button>
            ))}
            {icon && (
              <button
                type="button"
                className="emoji-clear-btn"
                onClick={() => setIcon('')}
                title="Use automatic website favicon"
              >
                Auto Favicon
              </button>
            )}
          </div>

          <label>Category (optional)
            <input value={category} onChange={event => setCategory(event.target.value)} placeholder="e.g. Work, Homelab, Media"/>
          </label>

          <div className="bookmark-preview-box">
            <p className="kicker">LIVE PREVIEW</p>
            <div className="bookmark-tile preview-tile-card">
              <a onClick={e => e.preventDefault()} href="#preview">
                <BookmarkFavicon url={url} icon={icon} name={name || 'Bookmark'}/>
                <span className="bookmark-copy">
                  <strong>{name || 'Bookmark Name'}</strong>
                  <small>{category || (url ? (() => { try { return new URL(url).hostname } catch { return '' } })() : 'domain.com')}</small>
                </span>
                <b aria-hidden="true" className="tile-arrow">↗</b>
              </a>
            </div>
          </div>
        </div>

        {error && <p className="form-error">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="button button-quiet" onClick={onClose}>Cancel</button>
          <button className="button button-primary">Save bookmark</button>
        </div>
      </form>
    </div>
  )
}

function WidgetSettings({
  widget,
  data,
  onClose,
  onSave
}: {
  widget: Widget
  data: WidgetData
  onClose: () => void
  onSave: (configuration: Record<string, unknown>) => void
}) {
  const [config, setConfig] = useState<Record<string, unknown>>({ ...widget.configuration })
  const type = widget.widgetType
  const definition = widgetRegistry[type]

  const isSearch = type.startsWith('search')
  const isBookmarks = type.startsWith('bookmarks')
  const isSingleBookmark = type === 'single-bookmark'
  const isNotifications = type.startsWith('notifications')
  const isPerformance = type.startsWith('performance') || type.startsWith('homelab-performance')
  const isClock = type === 'clock-hero'
  const isCountdown = type === 'countdown-event'
  const isStickyNote = type === 'sticky-note'

  const widgetBookmarks = useMemo(
    () => (isBookmarks ? data.bookmarks.filter(b => b.widgetId === widget.id) : data.bookmarks),
    [data.bookmarks, isBookmarks, widget.id]
  )

  const availableCategories = useMemo(() => {
    const set = new Set<string>()
    widgetBookmarks.forEach(b => {
      if (b.category?.trim()) set.add(b.category.trim())
    })
    return Array.from(set)
  }, [widgetBookmarks])

  return (
    <div className="overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <section className="dialog settings-dialog">
        <div className="dialog-heading">
          <div>
            <p className="kicker">CUSTOMIZE WIDGET · INSTANCE #{widget.id.slice(0, 6)}</p>
            <h2>{type.replace('-', ' ').toUpperCase()}</h2>
          </div>
          <button className="close-button" onClick={onClose} aria-label="Close"><Icon name="close"/></button>
        </div>

        <div className="dialog-grid-layout">
          {/* Controls Column */}
          <div className="dialog-controls-col">
            {isSearch && (
              <>
                <label>Search Provider
                  <select value={String(config.provider ?? 'google')} onChange={e => setConfig(prev => ({ ...prev, provider: e.target.value }))}>
                    <option value="google">Google</option>
                    <option value="duckduckgo">DuckDuckGo</option>
                    <option value="bing">Bing</option>
                    <option value="brave">Brave</option>
                    <option value="github">GitHub</option>
                    <option value="youtube">YouTube</option>
                  </select>
                </label>
                <label>Visual Style
                  <select value={String(config.searchStyle ?? (type === 'search-compact' ? 'compact' : 'pill'))} onChange={e => setConfig(prev => ({ ...prev, searchStyle: e.target.value }))}>
                    <option value="pill">Pill (Floating Glass Bar)</option>
                    <option value="compact">Compact (Minimal Clean)</option>
                    <option value="minimal">Minimal (Borderless Glass)</option>
                    <option value="floating-glow">Neon Glow</option>
                  </select>
                </label>
                {config.searchStyle !== 'compact' && config.searchStyle !== 'minimal' && (
                  <label className="check-label">
                    <input type="checkbox" checked={config.showEngineIcon !== false} onChange={e => setConfig(prev => ({ ...prev, showEngineIcon: e.target.checked }))}/>
                    Show search engine logo badge
                  </label>
                )}
                <label className="check-label">
                  <input type="checkbox" checked={config.openInNewTab !== false} onChange={e => setConfig(prev => ({ ...prev, openInNewTab: e.target.checked }))}/>
                  Open results in a new tab
                </label>
              </>
            )}

            {isBookmarks && (
              <>
                <label>Display Style
                  <select value={String(config.bookmarkStyle ?? (type === 'bookmarks-icons' ? 'icons-only' : type === 'bookmarks-dock' ? 'dock' : 'tiles'))} onChange={e => setConfig(prev => ({ ...prev, bookmarkStyle: e.target.value }))}>
                    <option value="icons-only">Icons Only (App Launchpad / No Text)</option>
                    <option value="tiles">Cards / Tiles with Host</option>
                    <option value="compact-chips">Compact Chips</option>
                    <option value="dock">Dock (macOS Floating Glass Dock)</option>
                  </select>
                </label>
                <label>Icon Scale
                  <select value={String(config.iconSize ?? 'normal')} onChange={e => setConfig(prev => ({ ...prev, iconSize: e.target.value }))}>
                    <option value="normal">Normal</option>
                    <option value="large">Large</option>
                  </select>
                </label>
                {availableCategories.length > 0 && (
                  <label>Filter by Bookmark Category
                    <select value={String(config.categoryFilter ?? 'all')} onChange={e => setConfig(prev => ({ ...prev, categoryFilter: e.target.value }))}>
                      <option value="all">All categories ({widgetBookmarks.length} links)</option>
                      {availableCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </label>
                )}
              </>
            )}

            {isSingleBookmark && (
              <>
                {data.bookmarks.length > 0 && (
                  <label>Select from Existing Bookmarks
                    <select
                      value={String(config.bookmarkId ?? '')}
                      onChange={e => {
                        const chosen = data.bookmarks.find(b => b.id === e.target.value)
                        if (chosen) {
                          setConfig(prev => ({
                            ...prev,
                            bookmarkId: chosen.id,
                            title: chosen.name,
                            url: chosen.url,
                            icon: chosen.icon || '',
                            subtitle: chosen.category || ''
                          }))
                        }
                      }}
                    >
                      <option value="">-- Choose saved link or enter manually below --</option>
                      {data.bookmarks.map(b => (
                        <option key={b.id} value={b.id}>{b.name} ({b.url})</option>
                      ))}
                    </select>
                  </label>
                )}
                <label>Title
                  <input
                    value={String(config.title ?? '')}
                    onChange={e => setConfig(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g. Proxmox Cluster, Home Assistant"
                  />
                </label>
                <label>Destination URL
                  <input
                    type="url"
                    value={String(config.url ?? '')}
                    onChange={e => setConfig(prev => ({ ...prev, url: e.target.value }))}
                    placeholder="https://..."
                  />
                </label>
                <label>Custom Emoji or Image URL
                  <input
                    value={String(config.icon ?? '')}
                    onChange={e => setConfig(prev => ({ ...prev, icon: e.target.value }))}
                    placeholder="e.g. ⚡ or https://... or leave empty for auto-favicon"
                  />
                </label>
                <label>Subtitle / Category
                  <input
                    value={String(config.subtitle ?? '')}
                    onChange={e => setConfig(prev => ({ ...prev, subtitle: e.target.value }))}
                    placeholder="e.g. Virtualization or port 8006"
                  />
                </label>
              </>
            )}

            {isNotifications && (
              <>
                <label>Notification Style
                  <select value={String(config.notificationStyle ?? (type === 'notifications-badge' ? 'badge-only' : type === 'notifications-ticker' ? 'compact-ticker' : 'cards'))} onChange={e => setConfig(prev => ({ ...prev, notificationStyle: e.target.value }))}>
                    <option value="cards">Glass Cards List</option>
                    <option value="timeline">Vertical Timeline</option>
                    <option value="compact-ticker">Compact Ticker (1-row stream)</option>
                    <option value="badge-only">Status Badge Counter (1×1 Chip)</option>
                  </select>
                </label>
                {config.notificationStyle !== 'badge-only' && (
                  <label>Max items displayed
                    <select value={Number(config.maxItems ?? 6)} onChange={e => setConfig(prev => ({ ...prev, maxItems: Number(e.target.value) }))}>
                      <option value={3}>3 notifications</option>
                      <option value={6}>6 notifications</option>
                      <option value={10}>10 notifications</option>
                    </select>
                  </label>
                )}
              </>
            )}

            {isPerformance && (
              <>
                <label>Performance Visualization
                  <select
                    value={String(config.perfStyle ?? (type === 'performance-graph' ? 'time-series-graph' : type === 'performance-kpi' ? 'kpi-stats' : 'radial-gauges'))}
                    onChange={e => setConfig(prev => ({ ...prev, perfStyle: e.target.value }))}
                  >
                    <option value="radial-gauges">Circular Radial Gauges (Dials)</option>
                    <option value="time-series-graph">Time Series Graph / Sparkline</option>
                    <option value="kpi-stats">KPI Stat Numbers (Compact)</option>
                    <option value="horizontal-bars">Horizontal Meter Bars</option>
                  </select>
                </label>
              </>
            )}

            {isClock && (
              <>
                <label>Clock Dial & Layout
                  <select
                    value={String(config.clockStyle ?? 'digital-modern')}
                    onChange={e => setConfig(prev => ({ ...prev, clockStyle: e.target.value }))}
                  >
                    <option value="digital-modern">Digital Modern (Hero Clean)</option>
                    <option value="analog-minimal">Analog Minimal (Liquid Glass Dial)</option>
                    <option value="world-clocks">World Clocks (Local & UTC)</option>
                  </select>
                </label>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={config.showSeconds === true}
                    onChange={e => setConfig(prev => ({ ...prev, showSeconds: e.target.checked }))}
                  />
                  Show live seconds (:ss)
                </label>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={config.format24h !== false}
                    onChange={e => setConfig(prev => ({ ...prev, format24h: e.target.checked }))}
                  />
                  24-Hour format (e.g. 15:30 vs 03:30 PM)
                </label>
              </>
            )}

            {isCountdown && (
              <>
                <label>Event Name
                  <input
                    value={String(config.title ?? '')}
                    onChange={e => setConfig(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g. Summer Vacation, Server Migration"
                  />
                </label>
                <label>Target Date & Time
                  <input
                    type="datetime-local"
                    value={String(config.targetDate ?? '')}
                    onChange={e => setConfig(prev => ({ ...prev, targetDate: e.target.value }))}
                  />
                </label>
                <label>Event Icon / Emoji
                  <input
                    value={String(config.icon ?? '🎯')}
                    onChange={e => setConfig(prev => ({ ...prev, icon: e.target.value }))}
                    placeholder="e.g. 🚀, ✈️, 🎂, ⚡"
                  />
                </label>
                <label>Visual Counter Style
                  <select
                    value={String(config.countdownStyle ?? 'hero-counter')}
                    onChange={e => setConfig(prev => ({ ...prev, countdownStyle: e.target.value }))}
                  >
                    <option value="hero-counter">Glass Digit Boxes (Days / Hours / Mins)</option>
                    <option value="compact-badge">Compact Badge (Single Line)</option>
                    <option value="progress-bar">Timeline Progress Bar</option>
                  </select>
                </label>
                {config.countdownStyle === 'progress-bar' && (
                  <label>Event Start Date (for % progress)
                    <input
                      type="datetime-local"
                      value={String(config.startDate ?? '')}
                      onChange={e => setConfig(prev => ({ ...prev, startDate: e.target.value }))}
                    />
                  </label>
                )}
              </>
            )}

            {isStickyNote && (
              <>
                <label>Note Format
                  <select
                    value={String(config.noteType ?? 'text')}
                    onChange={e => setConfig(prev => ({ ...prev, noteType: e.target.value }))}
                  >
                    <option value="text">Plain Text / Markdown Scratchpad</option>
                    <option value="checklist">Interactive Checklist (Tasks)</option>
                  </select>
                </label>
                <label>Pin Accent Color
                  <select
                    value={String(config.pinColor ?? 'blue')}
                    onChange={e => setConfig(prev => ({ ...prev, pinColor: e.target.value }))}
                  >
                    <option value="blue">Electric Blue</option>
                    <option value="emerald">Emerald Green</option>
                    <option value="amber">Warm Amber</option>
                    <option value="purple">Neon Purple</option>
                  </select>
                </label>
                <label>Note Content
                  <textarea
                    rows={4}
                    value={String(config.content ?? '')}
                    onChange={e => setConfig(prev => ({ ...prev, content: e.target.value }))}
                    placeholder={config.noteType === 'checklist' ? 'JSON items or one task per line' : 'Write text here...'}
                  />
                </label>
              </>
            )}

            <div className="settings-section-divider"/>
            <p className="kicker">APPEARANCE</p>
            <label>Card Background
              <select value={String(config.backgroundStyle ?? 'glass')} onChange={e => setConfig(prev => ({ ...prev, backgroundStyle: e.target.value }))}>
                <option value="glass">Liquid Glass (default)</option>
                <option value="transparent">Transparent (no background)</option>
                <option value="solid">Solid Dark</option>
                <option value="tinted">Tinted Accent</option>
              </select>
            </label>
            <label>Accent / Tint Color
              <select value={String(config.accentColor ?? 'default')} onChange={e => setConfig(prev => ({ ...prev, accentColor: e.target.value }))}>
                <option value="default">Default Blue</option>
                <option value="purple">Purple</option>
                <option value="emerald">Emerald</option>
                <option value="amber">Amber</option>
                <option value="rose">Rose</option>
                <option value="cyan">Cyan</option>
              </select>
            </label>

            <div className="settings-section-divider"/>
            <p className="kicker">CLICK REDIRECTION (OPTIONAL)</p>
            <label>Redirect URL on click
              <input
                type="url"
                value={String(config.redirectUrl ?? '')}
                onChange={e => setConfig(prev => ({ ...prev, redirectUrl: e.target.value }))}
                placeholder="https://proxmox.lan:8006 or https://..."
              />
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={config.redirectNewTab !== false}
                onChange={e => setConfig(prev => ({ ...prev, redirectNewTab: e.target.checked }))}
              />
              Open redirection in a new tab
            </label>
          </div>

          {/* Live Preview Column */}
          <div className="dialog-preview-col">
            <p className="kicker">LIVE GLASS PREVIEW</p>
            <div className="live-preview-box">
              {definition && (
                <WidgetRenderer
                  definition={definition}
                  props={{
                    widgetId: widget.id,
                    data,
                    state: 'ready',
                    editing: false,
                    configuration: config
                  }}
                />
              )}
            </div>
            <p className="subtle preview-hint">
              This preview updates live. Changes will only apply to this specific widget instance.
            </p>
          </div>
        </div>

        <div className="dialog-actions">
          <button className="button button-quiet" onClick={onClose}>Cancel</button>
          <button className="button button-primary" onClick={() => onSave(config)}>Save settings</button>
        </div>
      </section>
    </div>
  )
}

const CACHE_KEY = 'homedash_cache_v2'
const LEGACY_CACHE_KEY = 'homedash_cache_v1'
type StartpageCache = {
  user?: AuthUser
  profile?: DashboardProfile
  widgets?: Widget[]
  bookmarks?: Bookmark[]
  snapshot?: DashboardSnapshot | null
  performance?: PerformanceSnapshot | null
}

let memoryCache: StartpageCache | null = null

function readCache(): StartpageCache {
  if (memoryCache) return memoryCache
  try {
    localStorage.removeItem(LEGACY_CACHE_KEY)
    const raw = localStorage.getItem(CACHE_KEY)
    memoryCache = raw ? (JSON.parse(raw) as StartpageCache) : {}
  } catch {
    memoryCache = {}
  }
  return memoryCache
}

function compactPerformance(perf: PerformanceSnapshot | null | undefined): PerformanceSnapshot | null | undefined {
  if (!perf) return perf
  return perf.history && perf.history.length > 12 ? { ...perf, history: perf.history.slice(-12) } : perf
}

function writeCache(patch: Partial<StartpageCache>): void {
  try {
    const normalizedPatch: Partial<StartpageCache> = {
      ...patch,
      ...(patch.performance !== undefined ? { performance: compactPerformance(patch.performance) } : {})
    }
    const next = { ...readCache(), ...normalizedPatch }
    memoryCache = next
    localStorage.setItem(CACHE_KEY, JSON.stringify(next))
  } catch {
    /* Ignore storage quota errors. */
  }
}

function clearCache(): void {
  memoryCache = {}
  try {
    localStorage.removeItem(CACHE_KEY)
    localStorage.removeItem(LEGACY_CACHE_KEY)
  } catch {
    /* Ignore storage errors. */
  }
}

const WidgetRenderer = memo(function WidgetRenderer({ definition, props }: { definition: (typeof widgetRegistry)[string]; props: WidgetRenderProps }) {
  const Widget = definition.render
  return <Widget {...props} />
})

type GridMetrics = {
  left: number
  top: number
  cellWidth: number
  cellHeight: number
  gapX: number
  gapY: number
  columns: number
  rows: number
}

function measureGrid(grid: HTMLElement): GridMetrics {
  const rect = grid.getBoundingClientRect()
  const style = getComputedStyle(grid)
  const gapX = parseFloat(style.columnGap) || 0
  const gapY = parseFloat(style.rowGap) || 0
  const isMobile = window.innerWidth <= 720
  const columns = window.innerWidth <= 420 ? 2 : window.innerWidth <= 720 ? 4 : GRID_COLUMNS
  const rows = isMobile ? 12 : GRID_ROWS
  const padX = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0)
  const padY = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0)
  const cellWidth = (rect.width - padX - gapX * (columns - 1)) / columns
  const cellHeight = (rect.height - padY - gapY * (rows - 1)) / rows
  return { left: rect.left, top: rect.top, cellWidth, cellHeight, gapX, gapY, columns, rows }
}

function Dashboard({
  user,
  initialPayload,
  onUnauthenticated,
  onLogout
}: {
  user: AuthUser
  initialPayload: BootstrapPayload | null
  onUnauthenticated: () => void
  onLogout: () => void
}) {
  const initialCache = useMemo(() => readCache(), [])
  const [bootstrapReady, setBootstrapReady] = useState(() => Boolean(initialPayload))
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(() => initialPayload?.snapshot ?? initialCache.snapshot ?? null)
  const [performance, setPerformance] = useState<PerformanceSnapshot | null>(() => initialPayload?.performance ?? initialCache.performance ?? null)
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => initialPayload?.bookmarks ?? initialCache.bookmarks ?? [])
  const [widgets, setWidgets] = useState<Widget[]>(() => initialPayload?.widgets ?? initialCache.widgets ?? [])
  const [definitions, setDefinitions] = useState<ApiWidgetDefinition[]>([])
  const [profile, setProfile] = useState<DashboardProfile | null>(() => initialPayload?.profile ?? initialCache.profile ?? null)
  const [editing, setEditing] = useState(false)
  const [showCatalog, setShowCatalog] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<{ x: number; y: number } | null>(null)
  const [bookmarkDialog, setBookmarkDialog] = useState<{ bookmark?: Bookmark; widgetId?: string } | null>(null)
  const [settingsWidget, setSettingsWidget] = useState<Widget | null>(null)
  const [connection, setConnection] = useState<'loading' | 'online' | 'stale' | 'offline'>(() =>
    initialPayload || initialCache.widgets?.length ? 'online' : 'loading'
  )
  const [, setSaveState] = useState<ToastState>('saved')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const saveTimer = useRef<number | undefined>(undefined)
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve())
  const deletedWidgetIdsRef = useRef<Set<string>>(new Set())
  const gridRef = useRef<HTMLElement | null>(null)
  const dragRef = useRef<{ id: string; pointerId: number; startX: number; startY: number; origin: Widget['layout']; moved: boolean; mode: 'move' | 'resize'; edge?: string; metrics: GridMetrics } | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropCell, setDropCell] = useState<{ x: number; y: number; width: number; height: number } | null>(null)

  const data: WidgetData = useMemo(() => ({
    services: snapshot?.services ?? [],
    notifications: snapshot?.notifications ?? [],
    unreadNotifications: snapshot?.unreadNotifications ?? 0,
    bookmarks,
    performance
  }), [snapshot, bookmarks, performance])

  const enabledWidgets = useMemo(() => widgets.filter(widget => widget.isEnabled && widgetRegistry[widget.widgetType]), [widgets])
  const hasDashboardWidget = useMemo(
    () => enabledWidgets.some(w => w.widgetType.startsWith('notifications') || w.widgetType === 'service-status'),
    [enabledWidgets]
  )
  const hasPerfWidget = useMemo(
    () => enabledWidgets.some(w => w.widgetType === 'homelab-performance' || w.widgetType === 'performance-graph' || w.widgetType === 'performance-kpi'),
    [enabledWidgets]
  )

  // Compute occupied grid cells for generating empty "+" slots in edit mode
  const occupiedCells = useMemo(() => {
    const set = new Set<string>()
    for (const widget of enabledWidgets) {
      for (let x = widget.layout.x; x < widget.layout.x + widget.layout.width; x++) {
        for (let y = widget.layout.y; y < widget.layout.y + widget.layout.height; y++) {
          set.add(`${x},${y}`)
        }
      }
    }
    return set
  }, [enabledWidgets])

  const emptySlots = useMemo(() => {
    if (!editing) return []
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 720
    if (isMobile) return []
    const slots: { x: number; y: number }[] = []
    for (let y = 0; y < GRID_ROWS; y++) {
      for (let x = 0; x < GRID_COLUMNS; x++) {
        if (!occupiedCells.has(`${x},${y}`)) {
          slots.push({ x, y })
        }
      }
    }
    return slots
  }, [editing, occupiedCells])

  // Keyboard shortcuts (E to toggle edit mode, Esc to exit or close menus)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement)?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return

      if (event.key.toLowerCase() === 'e' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault()
        setEditing(v => !v)
        setContextMenu(null)
      } else if (event.key === 'Escape') {
        if (contextMenu) setContextMenu(null)
        if (menuOpen) setMenuOpen(false)
        if (editing) setEditing(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [contextMenu, menuOpen, editing])

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [contextMenu])

  useEffect(() => {
    if (!menuOpen) return
    const outside = (event: MouseEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [menuOpen])

  useEffect(() => {
    if (initialPayload) return
    let cancelled = false
    consumeInitialBootstrap()
      .then(payload => {
        if (cancelled) return
        if (payload.profile) {
          setProfile(prev => (prev?.id === payload.profile?.id && prev?.layoutVersion === payload.profile?.layoutVersion ? prev : payload.profile))
        }
        const activeWidgets = payload.widgets.filter(w => !deletedWidgetIdsRef.current.has(w.id))
        setWidgets(activeWidgets)
        setBookmarks(payload.bookmarks)
        if (payload.snapshot) setSnapshot(payload.snapshot)
        if (payload.performance) setPerformance(payload.performance)
        setConnection('online')
        setBootstrapReady(true)
        writeCache({
          user: payload.user,
          ...(payload.profile ? { profile: payload.profile } : {}),
          widgets: activeWidgets,
          bookmarks: payload.bookmarks,
          ...(payload.snapshot ? { snapshot: payload.snapshot } : {}),
          ...(payload.performance ? { performance: payload.performance } : {})
        })
      })
      .catch(err => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 401) {
          onUnauthenticated()
        } else {
          setConnection('offline')
        }
      })
    return () => { cancelled = true }
  }, [initialPayload, onUnauthenticated])

  useEffect(() => {
    if (!bootstrapReady || !hasDashboardWidget || snapshot) return
    const controller = new AbortController()
    fetchDashboard(controller.signal)
      .then(dash => {
        setSnapshot(dash)
        writeCache({ snapshot: dash })
        setConnection('online')
      })
      .catch(() => {
        if (!controller.signal.aborted) setConnection('offline')
      })
    return () => controller.abort()
  }, [bootstrapReady, hasDashboardWidget, snapshot])

  useEffect(() => {
    if (!bootstrapReady || !hasPerfWidget || performance) return
    const controller = new AbortController()
    fetchPerformance(controller.signal)
      .then(perf => {
        setPerformance(perf)
        writeCache({ performance: perf })
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [bootstrapReady, hasPerfWidget, performance])

  useEffect(() => {
    if (!hasPerfWidget) return
    const poll = () => {
      if (!document.hidden) {
        fetchPerformance()
          .then(perf => {
            setPerformance(perf)
            writeCache({ performance: perf })
          })
          .catch(() => undefined)
      }
    }
    const perfTimer = window.setInterval(poll, 5000)
    const onVisibility = () => { if (!document.hidden) poll() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(perfTimer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [hasPerfWidget])

  useEffect(() => {
    let source: EventSource | undefined
    let retry: number | undefined
    let idleHandle: number | undefined
    let fallbackTimer: number | undefined
    let stopped = false

    const connect = () => {
      if (stopped) return
      source = openEvents(event => {
        try {
          if ((JSON.parse(event.data) as { type: string }).type !== 'heartbeat') {
            fetchDashboard()
              .then(dash => {
                setSnapshot(dash)
                writeCache({ snapshot: dash })
              })
              .catch(() => setConnection('stale'))
          }
        } catch {
          /* Ignore invalid event payloads. */
        }
      }, state => {
        if (state === 'connected') setConnection('online')
        else if (state === 'reconnecting') setConnection('stale')
        else {
          setConnection('offline')
          if (!stopped) retry = window.setTimeout(connect, 5000)
        }
      })
    }

    const ric = window.requestIdleCallback
    if (typeof ric === 'function') {
      idleHandle = ric.call(window, connect, { timeout: 1200 })
    } else {
      fallbackTimer = window.setTimeout(connect, 600)
    }

    return () => {
      stopped = true
      if (idleHandle !== undefined && typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idleHandle)
      if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer)
      source?.close()
      if (retry) window.clearTimeout(retry)
    }
  }, [])

  useEffect(() => {
    if (!showCatalog || definitions.length > 0) return
    let cancelled = false
    fetchWidgetDefinitions().then(result => {
      if (!cancelled) setDefinitions(result.widgets)
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [showCatalog, definitions.length])

  const saveWidgets = useCallback((next: Widget[]) => {
    setWidgets(next)
    writeCache({ widgets: next })
    setSaveState('saving')
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      const toSave = next.filter(widget => !deletedWidgetIdsRef.current.has(widget.id))
      const persist = () => Promise.all(toSave.map(widget => updateWidget(widget.id, { layout: widget.layout, configuration: widget.configuration })))
      saveQueue.current = saveQueue.current.then(persist, persist).then(saved => {
        setWidgets(current => {
          const updated = current.map(widget => {
            const response = saved.find(item => item.id === widget.id)
            const sent = toSave.find(item => item.id === widget.id)
            return response && sent && JSON.stringify(widget.layout) === JSON.stringify(sent.layout) && JSON.stringify(widget.configuration) === JSON.stringify(sent.configuration) ? { ...widget, updatedAt: response.updatedAt } : widget
          })
          writeCache({ widgets: updated })
          return updated
        })
        setSaveState('saved')
      }).catch(() => setSaveState('error'))
    }, 450)
  }, [])

  const addWidget = async (definition: ApiWidgetDefinition) => {
    if (!profile) return
    const width = Math.min(GRID_COLUMNS, definition.initialSize.w)
    const height = Math.min(GRID_ROWS, definition.initialSize.h)

    let layout: GridLayout
    if (selectedSlot) {
      const targetX = Math.max(0, Math.min(GRID_COLUMNS - width, selectedSlot.x))
      const targetY = Math.max(0, Math.min(GRID_ROWS - height, selectedSlot.y))
      layout = findOpenLayout({ x: targetX, y: targetY, width, height }, widgets)
    } else {
      layout = findOpenLayout({ x: 0, y: 0, width, height }, widgets)
    }

    try {
      const created = await createWidget(profile.id, definition.type, definition.defaultConfiguration, layout)
      setWidgets(current => {
        const next = [...current, created]
        writeCache({ widgets: next })
        return next
      })
      setShowCatalog(false)
      setSelectedSlot(null)
    } catch {
      setSaveState('error')
    }
  }

  const removeWidget = async (widget: Widget) => {
    deletedWidgetIdsRef.current.add(widget.id)
    const previousWidgets = widgets
    const nextWidgets = widgets.filter(item => item.id !== widget.id)
    setWidgets(nextWidgets)
    writeCache({ widgets: nextWidgets })
    try {
      await deleteWidget(widget.id)
      setBookmarks(current => {
        const nextBookmarks = current.filter(b => b.widgetId !== widget.id)
        writeCache({ bookmarks: nextBookmarks })
        return nextBookmarks
      })
    } catch {
      deletedWidgetIdsRef.current.delete(widget.id)
      setWidgets(previousWidgets)
      writeCache({ widgets: previousWidgets })
      setSaveState('error')
    }
  }

  const updateConfiguration = useCallback((widget: Widget, configuration: Record<string, unknown>) => {
    setSettingsWidget(null)
    setWidgets(current => {
      const next = current.map(item => item.id === widget.id ? { ...item, configuration } : item)
      saveWidgets(next)
      return next
    })
  }, [saveWidgets])

  const removeBookmark = useCallback(async (bookmark: Bookmark) => {
    try {
      await deleteBookmark(bookmark.id)
      setBookmarks(current => {
        const next = current.filter(item => item.id !== bookmark.id)
        writeCache({ bookmarks: next })
        return next
      })
    } catch {
      setSaveState('error')
    }
  }, [])

  const bookmarkSaved = (saved: Bookmark) => setBookmarks(current => {
    const next = bookmarkDialog?.bookmark ? current.map(item => item.id === saved.id ? saved : item) : [...current, saved]
    writeCache({ bookmarks: next })
    return next
  })

  const reorderBookmarks = useCallback(async (orderedIds: string[]) => {
    const orderMap = new Map(orderedIds.map((id, idx) => [id, idx]))
    const previous = bookmarks
    const updates: { id: string; sortOrder: number }[] = []

    const next = bookmarks.map(item => {
      const nextOrder = orderMap.get(item.id)
      if (nextOrder === undefined) return item
      if (item.sortOrder !== nextOrder) updates.push({ id: item.id, sortOrder: nextOrder })
      return { ...item, sortOrder: nextOrder }
    })
    next.sort((a, b) => a.sortOrder - b.sortOrder)

    setBookmarks(next)
    writeCache({ bookmarks: next })

    if (!updates.length) return
    try {
      await Promise.all(updates.map(u => updateBookmark(u.id, { sortOrder: u.sortOrder })))
    } catch {
      setBookmarks(previous)
      writeCache({ bookmarks: previous })
      setSaveState('error')
    }
  }, [bookmarks])

  const cellFromMetrics = (clientX: number, clientY: number, metrics: GridMetrics) => ({
    x: Math.max(0, Math.min(metrics.columns - 1, Math.floor((clientX - metrics.left) / (metrics.cellWidth + metrics.gapX)))),
    y: Math.max(0, Math.min(metrics.rows - 1, Math.floor((clientY - metrics.top) / (metrics.cellHeight + metrics.gapY))))
  })

  const onDragStart = (event: PointerEvent, widget: Widget, mode: 'move' | 'resize' = 'move', edge?: string) => {
    if (!editing || !gridRef.current) return
    event.preventDefault()
    event.stopPropagation()
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    const metrics = measureGrid(gridRef.current)
    dragRef.current = { id: widget.id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: widget.layout, moved: false, mode, edge, metrics }
    setDraggingId(widget.id)
    setDropCell({ ...widget.layout })
  }

  const onDragMove = (event: PointerEvent) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const { metrics } = drag
    const cell = cellFromMetrics(event.clientX, event.clientY, metrics)
    const widget = widgets.find(item => item.id === drag.id)
    if (!widget) return
    const min = widgetRegistry[widget.widgetType]?.minSize ?? { width: 1, height: 1 }

    if (drag.mode === 'move') {
      setDropCell({
        ...drag.origin,
        x: Math.max(0, Math.min(metrics.columns - drag.origin.width, cell.x)),
        y: Math.max(0, Math.min(metrics.rows - drag.origin.height, cell.y))
      })
    } else {
      const dx = Math.round((event.clientX - drag.startX) / metrics.cellWidth)
      const dy = Math.round((event.clientY - drag.startY) / metrics.cellHeight)
      const edge = drag.edge ?? 'se'
      let { x, y, width, height } = drag.origin
      if (edge.includes('e')) width = Math.max(min.width, Math.min(metrics.columns - x, width + dx))
      if (edge.includes('s')) height = Math.max(min.height, Math.min(metrics.rows - y, height + dy))
      if (edge.includes('w')) {
        const nextWidth = Math.max(min.width, Math.min(width - dx, drag.origin.x + drag.origin.width))
        x = drag.origin.x + drag.origin.width - nextWidth
        width = nextWidth
      }
      if (edge.includes('n')) {
        const nextHeight = Math.max(min.height, Math.min(height - dy, drag.origin.y + drag.origin.height))
        y = drag.origin.y + drag.origin.height - nextHeight
        height = nextHeight
      }
      setDropCell({ x, y, width, height })
    }
    if (Math.abs(event.clientX - drag.startX) + Math.abs(event.clientY - drag.startY) > 5) drag.moved = true
  }

  const onDragEnd = (event: PointerEvent) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    setDraggingId(null)
    setDropCell(null)
    if (!drag.moved) return
    const widget = widgets.find(item => item.id === drag.id)
    if (!widget) return
    const { metrics } = drag
    const cell = cellFromMetrics(event.clientX, event.clientY, metrics)
    const target = drag.mode === 'resize' ? dropCell : {
      ...drag.origin,
      x: Math.min(metrics.columns - drag.origin.width, cell.x),
      y: Math.min(metrics.rows - drag.origin.height, cell.y)
    }
    if (!target) return
    const definition = widgetRegistry[widget.widgetType]
    const result = moveWidget(widgets, widget.id, target, definition?.minSize ?? { width: 1, height: 1 })
    saveWidgets(result)
  }

  const onCanvasContextMenu = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement
    if (target.closest('input, textarea, a, select, button, .widget-toolbar, .resize-handle')) return
    event.preventDefault()
    setContextMenu({ x: event.clientX, y: event.clientY })
  }

  const onCanvasDoubleClick = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement
    if (target.closest('input, textarea, a, select, button, .widget-toolbar, .resize-handle')) return
    setEditing(prev => !prev)
  }

  return (
    <main
      className="app-frame"
      onContextMenu={onCanvasContextMenu}
      onDoubleClick={onCanvasDoubleClick}
    >
      {/* Invisible auto-revealing menu trigger at top-right (no permanent gear icon) */}
      <div className="corner-hotzone" ref={menuRef}>
        <button
          className="corner-trigger-btn"
          aria-label="Dashboard menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(v => !v)}
        >
          <span>Menu</span>
          <Icon name="arrow" size={12}/>
        </button>
        {menuOpen && (
          <div className="gear-dropdown" role="menu">
            <div className="menu-user">{user.username}</div>
            <button role="menuitem" onClick={() => { setEditing(v => !v); setMenuOpen(false) }}>
              <Icon name={editing ? 'check' : 'edit'} size={15}/>
              {editing ? 'Done editing (E)' : 'Edit dashboard (E)'}
            </button>
            <button role="menuitem" onClick={() => { setSelectedSlot(null); setShowCatalog(true); setMenuOpen(false) }}>
              <Icon name="plus" size={15}/>
              Add widget
            </button>
            <button role="menuitem" onClick={() => { setMenuOpen(false); onLogout() }}>
              <Icon name="logout" size={15}/>
              Log out
            </button>
          </div>
        )}
      </div>

      {/* Right-click canvas context menu */}
      {contextMenu && (
        <div
          className="canvas-context-menu"
          style={{ top: contextMenu.y, left: Math.min(window.innerWidth - 220, contextMenu.x) }}
          role="menu"
          onClick={e => e.stopPropagation()}
        >
          <div className="menu-header">Dashboard</div>
          <button role="menuitem" onClick={() => { setEditing(v => !v); setContextMenu(null) }}>
            <Icon name={editing ? 'check' : 'edit'} size={15}/>
            {editing ? 'Done editing' : 'Edit dashboard'}
          </button>
          <button role="menuitem" onClick={() => { setSelectedSlot(null); setShowCatalog(true); setContextMenu(null) }}>
            <Icon name="plus" size={15}/>
            Add widget
          </button>
          <div className="context-menu-divider"/>
          <button role="menuitem" className="logout-item" onClick={() => { setContextMenu(null); onLogout() }}>
            <Icon name="logout" size={15}/>
            Log out
          </button>
        </div>
      )}

      {/* Floating dock control bar when editing */}
      {editing && (
        <aside className="edit-dock-bar">
          <div className="edit-dock-badge">
            <span className="edit-pulse-dot"/>
            Editing Mode
          </div>
          <button
            type="button"
            className="button button-add"
            onClick={() => { setSelectedSlot(null); setShowCatalog(true) }}
          >
            <Icon name="plus" size={14}/> Add widget
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={() => setEditing(false)}
            title="Exit edit mode (Esc or E)"
          >
            <Icon name="check" size={14}/> Done
          </button>
          <button
            type="button"
            className="button button-quiet"
            onClick={onLogout}
            title="Log out"
          >
            <Icon name="logout" size={14}/>
          </button>
        </aside>
      )}

      {!enabledWidgets.length && !editing ? (
        <section className="widget-grid empty-dashboard" style={{ '--grid-cols': GRID_COLUMNS, '--grid-rows': GRID_ROWS } as React.CSSProperties} aria-label="Dashboard widgets">
          <p>Your canvas is empty.</p>
          <button className="button button-primary" onClick={() => { setEditing(true); setShowCatalog(true) }}>
            Add widget
          </button>
        </section>
      ) : (
        <section
          ref={gridRef}
          className={`widget-grid ${editing ? 'editing' : ''} ${draggingId ? 'is-dragging' : ''}`}
          style={{ '--grid-cols': GRID_COLUMNS, '--grid-rows': GRID_ROWS } as React.CSSProperties}
          aria-label="Dashboard widgets"
        >
          {/* Enabled widgets */}
          {enabledWidgets.map(widget => {
            const definition = widgetRegistry[widget.widgetType]
            const hasRedirect = Boolean(widget.configuration.redirectUrl) && !editing

            const bgStyle = String(widget.configuration.backgroundStyle ?? 'glass')
            const accentColor = String(widget.configuration.accentColor ?? 'default')
            const ACCENT_MAP: Record<string, string> = {
              default: '#6ea8ff',
              purple: '#a78bfa',
              emerald: '#34d399',
              amber: '#fbbf24',
              rose: '#fb7185',
              cyan: '#22d3ee'
            }
            const widgetStyleVars: React.CSSProperties = {
              ...(accentColor !== 'default' ? { '--accent': ACCENT_MAP[accentColor] ?? ACCENT_MAP.default, '--accent-soft': `${ACCENT_MAP[accentColor] ?? ACCENT_MAP.default}33` } as React.CSSProperties : {}),
            }

            const isPerfWidget = widget.widgetType === 'homelab-performance' || widget.widgetType.startsWith('performance')
            const isDashWidget = widget.widgetType.startsWith('notifications') || widget.widgetType === 'service-status'
            const hasWidgetData = isPerfWidget ? Boolean(performance) : isDashWidget ? Boolean(snapshot) : true

            const props = {
              widgetId: widget.id,
              data,
              state: !hasWidgetData
                ? (connection === 'offline' ? 'offline' as const : 'loading' as const)
                : connection === 'offline'
                  ? 'stale' as const
                  : connection === 'stale'
                    ? 'stale' as const
                    : 'ready' as const,
              message: snapshot?.sourceStates?.notifications,
              editing,
              configuration: widget.configuration,
              onConfigurationChange: (configuration: Record<string, unknown>) => updateConfiguration(widget, configuration),
              onBookmarkChange: () => setBookmarkDialog({ widgetId: widget.id }),
              onBookmarkDelete: removeBookmark,
              onBookmarkEdit: (bookmark: Bookmark) => setBookmarkDialog({ bookmark, widgetId: widget.id }),
              onBookmarkReorder: reorderBookmarks
            }

            return (
              <article
                key={widget.id}
                className={`widget-shell ${editing ? 'is-editing' : ''} ${draggingId === widget.id ? 'is-dragging' : ''} ${hasRedirect ? 'has-redirect' : ''} widget-bg-${bgStyle}`}
                style={{
                  gridColumn: `${widget.layout.x + 1} / span ${widget.layout.width}`,
                  gridRow: `${widget.layout.y + 1} / span ${widget.layout.height}`,
                  ...widgetStyleVars
                }}
                onClick={event => {
                  if (editing) return
                  const target = event.target as HTMLElement
                  if (target.closest('a, button, input, select, textarea, [role="button"], .resize-handle, .widget-toolbar')) return
                  const url = String(widget.configuration.redirectUrl ?? '').trim()
                  if (!url) return
                  const inNewTab = widget.configuration.redirectNewTab !== false
                  try {
                    const parsed = new URL(url)
                    if (['http:', 'https:'].includes(parsed.protocol)) {
                      window.open(url, inNewTab ? '_blank' : '_self', 'noopener,noreferrer')
                    }
                  } catch {
                    if (url.startsWith('/')) window.location.href = url
                  }
                }}
              >
                {editing && (
                  <div className="widget-toolbar">
                    <button
                      className="drag-handle"
                      aria-label={`Move ${definition?.type ?? 'widget'}`}
                      title="Drag to move"
                      onPointerDown={event => onDragStart(event, widget)}
                      onPointerMove={onDragMove}
                      onPointerUp={onDragEnd}
                      onPointerCancel={onDragEnd}
                    >
                      <Icon name="move" size={13}/>
                    </button>
                    <strong>{definition?.type.replaceAll('-', ' ')}</strong>
                    <div className="widget-toolbar-actions">
                      <button onClick={() => setSettingsWidget(widget)} aria-label="Customize widget" title="Customize widget">
                        <Icon name="edit" size={14}/>
                      </button>
                      <button className="remove-widget" onClick={() => void removeWidget(widget)} aria-label="Remove widget" title="Remove">
                        <Icon name="remove" size={13}/>
                      </button>
                    </div>
                  </div>
                )}
                {definition && <WidgetRenderer definition={definition} props={props}/>}
                {hasRedirect && <span className="redirect-hint-arrow" aria-hidden="true" title={`Redirects to ${widget.configuration.redirectUrl}`}>↗</span>}
                {editing && ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].map(edge => (
                  <span
                    key={edge}
                    className={`resize-handle resize-${edge}`}
                    role="separator"
                    aria-label={`Resize ${definition?.type ?? 'widget'} ${edge}`}
                    onPointerDown={event => onDragStart(event, widget, 'resize', edge)}
                    onPointerMove={onDragMove}
                    onPointerUp={onDragEnd}
                    onPointerCancel={onDragEnd}
                  />
                ))}
              </article>
            )
          })}

          {/* Empty grid slots with "+" button rendered during editing mode */}
          {editing && emptySlots.map(slot => (
            <button
              key={`slot-${slot.x}-${slot.y}`}
              type="button"
              className="empty-grid-slot"
              style={{
                gridColumn: `${slot.x + 1} / span 1`,
                gridRow: `${slot.y + 1} / span 1`
              }}
              onClick={() => {
                setSelectedSlot({ x: slot.x, y: slot.y })
                setShowCatalog(true)
              }}
              aria-label={`Add widget at cell ${slot.x + 1}, ${slot.y + 1}`}
              title={`Add widget at (${slot.x + 1}, ${slot.y + 1})`}
            >
              <Icon name="plus" size={16}/>
            </button>
          ))}

          {dropCell && draggingId && (
            <div
              className="drop-indicator"
              style={{
                gridColumn: `${dropCell.x + 1} / span ${dropCell.width}`,
                gridRow: `${dropCell.y + 1} / span ${dropCell.height}`
              }}
            />
          )}
        </section>
      )}

      {showCatalog && (
        <WidgetCatalog
          definitions={definitions}
          widgets={widgets}
          selectedSlot={selectedSlot}
          onClose={() => { setShowCatalog(false); setSelectedSlot(null) }}
          onAdd={addWidget}
        />
      )}

      {bookmarkDialog && profile && (
        <BookmarkDialog
          profileId={profile.id}
          widgetId={bookmarkDialog.widgetId}
          nextSortOrder={
            bookmarkDialog.bookmark
              ? undefined
              : bookmarks
                  .filter(b => b.widgetId === bookmarkDialog.widgetId)
                  .reduce((max, b) => Math.max(max, b.sortOrder + 1), 0)
          }
          bookmark={bookmarkDialog.bookmark}
          onClose={() => setBookmarkDialog(null)}
          onSaved={bookmarkSaved}
        />
      )}

      {settingsWidget && (
        <WidgetSettings
          widget={settingsWidget}
          data={data}
          onClose={() => setSettingsWidget(null)}
          onSave={configuration => updateConfiguration(settingsWidget, configuration)}
        />
      )}
    </main>
  )
}

/* =========================================================================
   WIDGET CATALOG & CATEGORIES
   ========================================================================= */

type CatalogCategory = 'all' | 'time' | 'notifications' | 'bookmarks' | 'search' | 'system'

type CatalogEntryMeta = {
  category: CatalogCategory
  title: string
  subtitle: string
  description: string
  icon: IconName
}

const CATALOG_METADATA: Record<string, CatalogEntryMeta> = {
  search: {
    category: 'search',
    title: 'Search Bar',
    subtitle: 'Floating Glass Pill',
    description: 'Web search bar with engine switcher, Google/DuckDuckGo logos, and Ctrl+K shortcut.',
    icon: 'search'
  },
  'search-compact': {
    category: 'search',
    title: 'Search Minimal',
    subtitle: 'Compact Input',
    description: 'Minimal borderless search box designed for small 1-cell or 2-cell spaces.',
    icon: 'search'
  },
  bookmarks: {
    category: 'bookmarks',
    title: 'Bookmark Cards',
    subtitle: 'Detailed Tiles',
    description: 'Rich quick links displaying site title, hostname, and direct launch button.',
    icon: 'bookmark'
  },
  'bookmarks-icons': {
    category: 'bookmarks',
    title: 'Bookmark Launchpad',
    subtitle: 'Icons Only (No Text)',
    description: 'Clean app launchpad with favicons only and floating hover tooltips.',
    icon: 'grid'
  },
  'bookmarks-dock': {
    category: 'bookmarks',
    title: 'Bookmark Dock',
    subtitle: 'macOS Glass Dock',
    description: 'Centred horizontal dock of links with zoom and lift animation on hover.',
    icon: 'bookmark'
  },
  'single-bookmark': {
    category: 'bookmarks',
    title: 'Single Link Tile',
    subtitle: 'Hero Square / App Button',
    description: 'A large dedicated glass square for a single destination like Proxmox or Home Assistant.',
    icon: 'bookmark'
  },
  notifications: {
    category: 'notifications',
    title: 'Notification Feed',
    subtitle: 'List, Cards & Timeline',
    description: 'Comprehensive activity stream from Notification Center with severity glow and relative time.',
    icon: 'bell'
  },
  'notifications-badge': {
    category: 'notifications',
    title: 'Notification Chip',
    subtitle: 'Status Counter Badge',
    description: 'Minimal 1×1 glass bell badge with unread alert counter and live activity pulse.',
    icon: 'bell'
  },
  'notifications-ticker': {
    category: 'notifications',
    title: 'Notification Ticker',
    subtitle: 'Single-Row Headline',
    description: 'Ultra-compact single-line ticker rotating the latest unread homelab alert.',
    icon: 'bell'
  },
  'homelab-performance': {
    category: 'system',
    title: 'Hardware Dials',
    subtitle: 'Circular Gauges',
    description: 'Radial glass dials for CPU, RAM, and GPU percentage utilization.',
    icon: 'activity'
  },
  'performance-graph': {
    category: 'system',
    title: 'Performance Graph',
    subtitle: 'Live Sparkline Timeline',
    description: 'Continuous time-series graph tracking activity and usage over time.',
    icon: 'activity'
  },
  'performance-kpi': {
    category: 'system',
    title: 'Performance Numbers',
    subtitle: 'Compact Stat Tiles',
    description: 'Large minimal percentage stats for small 1-cell or 2-cell slots.',
    icon: 'activity'
  },
  'service-status': {
    category: 'system',
    title: 'Service Health',
    subtitle: 'Infrastructure Checks',
    description: 'Real-time healthcheck status and response status of internal homelab services.',
    icon: 'grid'
  },
  'clock-hero': {
    category: 'time',
    title: 'Clock Hero',
    subtitle: 'Digital, Analog & World',
    description: 'Customizable liquid-glass clock with seconds, analog dial, and world timezones.',
    icon: 'activity'
  },
  'countdown-event': {
    category: 'time',
    title: 'Event Countdown',
    subtitle: 'Days & Time Remaining',
    description: 'Track days, hours, and seconds left for vacations, releases, or renewals with progress bars.',
    icon: 'activity'
  },
  'sticky-note': {
    category: 'time',
    title: 'Sticky Note & Checklist',
    subtitle: 'Scratchpad or Tasks',
    description: 'Jot down commands, homelab IP notes, or interactive todo items directly on your canvas.',
    icon: 'edit'
  }
}

function WidgetCatalog({
  definitions,
  widgets,
  selectedSlot,
  onClose,
  onAdd
}: {
  definitions: ApiWidgetDefinition[]
  widgets: Widget[]
  selectedSlot: { x: number; y: number } | null
  onClose: () => void
  onAdd: (definition: ApiWidgetDefinition) => void
}) {
  const [activeTab, setActiveTab] = useState<CatalogCategory>('all')

  const categories: { key: CatalogCategory; label: string }[] = [
    { key: 'all', label: 'All widgets' },
    { key: 'time', label: 'Time & Notes' },
    { key: 'notifications', label: 'Notifications' },
    { key: 'bookmarks', label: 'Bookmarks' },
    { key: 'search', label: 'Search' },
    { key: 'system', label: 'System' }
  ]

  const filtered = definitions.filter(def => {
    if (activeTab === 'all') return true
    const meta = CATALOG_METADATA[def.type]
    return meta?.category === activeTab
  })

  return (
    <div className="overlay catalog-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <section className="catalog-panel">
        <div className="catalog-header">
          <div>
            <p className="kicker">
              {selectedSlot ? `PLACING AT CELL (${selectedSlot.x + 1}, ${selectedSlot.y + 1})` : 'PERSONALIZE YOUR CANVAS'}
            </p>
            <h2>Widget Library</h2>
            <p className="subtle">Add any widget to your dashboard. Multiple instances of any widget are supported.</p>
          </div>
          <button className="close-button" onClick={onClose} aria-label="Close"><Icon name="close"/></button>
        </div>

        {/* Category Tabs */}
        <div className="catalog-tabs" role="tablist">
          {categories.map(cat => (
            <button
              key={cat.key}
              type="button"
              role="tab"
              aria-selected={activeTab === cat.key}
              className={`catalog-tab-btn ${activeTab === cat.key ? 'active' : ''}`}
              onClick={() => setActiveTab(cat.key)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Widgets Grid */}
        <div className="catalog-grid">
          {filtered.map(definition => {
            const meta = CATALOG_METADATA[definition.type] ?? {
              category: 'system' as CatalogCategory,
              title: definition.type.replaceAll('-', ' '),
              subtitle: 'Widget',
              description: 'HomeDash dashboard widget.',
              icon: 'grid' as IconName
            }

            // Count existing instances of this type
            const activeCount = widgets.filter(w => w.widgetType === definition.type && w.isEnabled).length

            return (
              <article className="catalog-card" key={definition.type}>
                <div className="catalog-card-top">
                  <span className="catalog-icon"><Icon name={meta.icon} size={17}/></span>
                  <div className="catalog-badges">
                    {activeCount > 0 && (
                      <span className="catalog-count-pill">{activeCount} on canvas</span>
                    )}
                    <span className="catalog-size">{definition.initialSize.w} × {definition.initialSize.h}</span>
                  </div>
                </div>
                <h3>{meta.title}</h3>
                <span className="catalog-subtitle">{meta.subtitle}</span>
                <p>{meta.description}</p>
                <button
                  type="button"
                  className="button button-add"
                  onClick={() => onAdd(definition)}
                >
                  <Icon name="plus" size={13}/>
                  {selectedSlot ? `Place at (${selectedSlot.x + 1}, ${selectedSlot.y + 1})` : 'Add widget'}
                </button>
              </article>
            )
          })}
        </div>

        <div className="catalog-foot">
          {selectedSlot
            ? `Selected slot: Row ${selectedSlot.y + 1}, Column ${selectedSlot.x + 1}. You can resize and move it anytime.`
            : 'You can drag, resize, and configure multiple copies of each widget freely on the grid.'}
        </div>
      </section>
    </div>
  )
}

function App() {
  const [user, setUser] = useState<AuthUser | null>(() => readCache().user ?? null)
  const [initialPayload, setInitialPayload] = useState<BootstrapPayload | null>(null)
  const [checking, setChecking] = useState(() => !readCache().user)

  const savePayloadToCache = useCallback((payload: BootstrapPayload) => {
    writeCache({
      user: payload.user,
      ...(payload.profile ? { profile: payload.profile } : {}),
      widgets: payload.widgets,
      bookmarks: payload.bookmarks,
      ...(payload.snapshot ? { snapshot: payload.snapshot } : {}),
      ...(payload.performance ? { performance: payload.performance } : {})
    })
  }, [])

  useEffect(() => {
    if (!checking) return
    consumeInitialBootstrap()
      .then(payload => {
        savePayloadToCache(payload)
        setInitialPayload(payload)
        setUser(payload.user)
      })
      .catch(err => {
        if (err instanceof ApiError && err.status === 401) {
          clearCache()
          setInitialPayload(null)
          setUser(null)
        }
      })
      .finally(() => setChecking(false))
  }, [checking, savePayloadToCache])

  const handleUnauthenticated = useCallback(() => {
    clearCache()
    setInitialPayload(null)
    setUser(null)
  }, [])

  if (checking) {
    return (
      <main className="login-page">
        <div className="login-card loading-card">
          <span className="brand-symbol"><Icon name="grid"/></span>
          <p>Loading dashboard…</p>
        </div>
      </main>
    )
  }

  if (!user) {
    return (
      <LoginScreen
        onAuthenticated={authenticatedUser => {
          fetchBootstrap('desktop')
            .then(payload => {
              savePayloadToCache(payload)
              setInitialPayload(payload)
              setUser(payload.user)
            })
            .catch(() => {
              writeCache({ user: authenticatedUser })
              setUser(authenticatedUser)
            })
        }}
      />
    )
  }

  return (
    <Dashboard
      user={user}
      initialPayload={initialPayload}
      onUnauthenticated={handleUnauthenticated}
      onLogout={async () => {
        clearCache()
        setInitialPayload(null)
        await logout().catch(() => undefined)
        setUser(null)
      }}
    />
  )
}

export default App
