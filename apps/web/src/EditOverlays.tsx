import { useMemo, useState, type FormEvent } from 'react'
import {
  createBookmark,
  searchWeatherLocations,
  updateBookmark,
  type Bookmark,
  type WeatherLocationResult,
  type Widget,
  type WidgetDefinition as ApiWidgetDefinition
} from './api'
import { Icon, type IconName } from './Icon'
import { widgetRegistry } from './widgets/registry'
import { BookmarkFavicon } from './widgets/shared'
import type { WidgetData } from './widgets/types'
import './EditOverlays.css'

const PRESET_EMOJIS = ['🌐', '🚀', '💻', '🏠', '📦', '📊', '⚡', '🔒', '🎬', '🎮', '⚙️', '📁', '🐳', '🛡️', '📈', '🗄️']

export function BookmarkDialog({
  bookmark,
  profileId,
  widgetId,
  nextSortOrder,
  onClose,
  onSaved
}: {
  bookmark?: Bookmark
  profileId: string
  widgetId?: string
  nextSortOrder?: number
  onClose: () => void
  onSaved: (bookmark: Bookmark) => void
}) {
  const [name, setName] = useState(bookmark?.name ?? '')
  const [url, setUrl] = useState(bookmark?.url ?? '')
  const [category, setCategory] = useState(bookmark?.category ?? '')
  const [icon, setIcon] = useState(bookmark?.icon ?? '')
  const [error, setError] = useState('')

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

export function WidgetSettings({
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
  const PreviewComponent = definition?.render

  const isSearch = type.startsWith('search')
  const isBookmarks = type.startsWith('bookmarks')
  const isSingleBookmark = type === 'single-bookmark'
  const isNotifications = type.startsWith('notifications')
  const isPerformance = type.startsWith('performance') || type.startsWith('homelab-performance')
  const isClock = type === 'clock-hero'
  const isCountdown = type === 'countdown-event'
  const isStickyNote = type === 'sticky-note'
  const isWeather = type === 'weather-forecast'
  const isEnvironment = type === 'environment-sensor'
  const usesWeatherLocation = isWeather || isEnvironment

  const [locationQuery, setLocationQuery] = useState('')
  const [locationResults, setLocationResults] = useState<WeatherLocationResult[]>([])
  const [searchingLocation, setSearchingLocation] = useState(false)

  const handleLocationSearch = async () => {
    const q = locationQuery.trim()
    if (q.length < 2) return
    setSearchingLocation(true)
    try {
      const res = await searchWeatherLocations(q)
      setLocationResults(res.locations)
    } catch {
      setLocationResults([])
    } finally {
      setSearchingLocation(false)
    }
  }

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

            {usesWeatherLocation && (
              <>
                <label>Find City (Open-Meteo)
                  <div className="location-search-row">
                    <input
                      value={locationQuery}
                      onChange={e => setLocationQuery(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleLocationSearch() } }}
                      placeholder="e.g. Sevilla, Madrid, London"
                    />
                    <button
                      type="button"
                      className="button button-quiet"
                      onClick={() => void handleLocationSearch()}
                      disabled={searchingLocation}
                    >
                      {searchingLocation ? '…' : 'Search'}
                    </button>
                  </div>
                </label>
                {locationResults.length > 0 && (
                  <div className="location-results-list">
                    {locationResults.map(loc => (
                      <button
                        key={`${loc.name}-${loc.latitude}-${loc.longitude}`}
                        type="button"
                        className="location-result-btn"
                        onClick={() => {
                          setConfig(prev => ({
                            ...prev,
                            locationName: loc.name,
                            latitude: loc.latitude,
                            longitude: loc.longitude
                          }))
                          setLocationResults([])
                          setLocationQuery('')
                        }}
                      >
                        <strong>{loc.name}</strong>
                        <small>{[loc.admin1, loc.country].filter(Boolean).join(', ')} ({loc.latitude}, {loc.longitude})</small>
                      </button>
                    ))}
                  </div>
                )}
                <label>Location Label
                  <input
                    value={String(config.locationName ?? 'Madrid')}
                    onChange={e => setConfig(prev => ({ ...prev, locationName: e.target.value }))}
                  />
                </label>
                <div className="coord-inputs-row">
                  <label>Latitude
                    <input
                      type="number"
                      step="0.01"
                      min="-90"
                      max="90"
                      value={Number(config.latitude ?? 40.42)}
                      onChange={e => setConfig(prev => ({ ...prev, latitude: Number(e.target.value) }))}
                    />
                  </label>
                  <label>Longitude
                    <input
                      type="number"
                      step="0.01"
                      min="-180"
                      max="180"
                      value={Number(config.longitude ?? -3.7)}
                      onChange={e => setConfig(prev => ({ ...prev, longitude: Number(e.target.value) }))}
                    />
                  </label>
                </div>
                <label>Units
                  <select
                    value={String(config.units ?? 'metric')}
                    onChange={e => setConfig(prev => ({ ...prev, units: e.target.value }))}
                  >
                    <option value="metric">Metric (°C, km/h)</option>
                    <option value="imperial">Imperial (°F, mph)</option>
                  </select>
                </label>
                {isWeather && (
                  <label>Weather Layout
                    <select
                      value={String(config.weatherStyle ?? 'card-detailed')}
                      onChange={e => setConfig(prev => ({ ...prev, weatherStyle: e.target.value }))}
                    >
                      <option value="card-detailed">Detailed Card (High/Low, Wind & Rain)</option>
                      <option value="card-compact">Compact Tile (Ideal for 1×1 / 2×1)</option>
                      <option value="hourly-forecast">12-Hour Forecast Strip</option>
                    </select>
                  </label>
                )}
                {isEnvironment && (
                  <>
                    <label>Sensor Visual Style
                      <select
                        value={String(config.sensorStyle ?? 'radial-gauge')}
                        onChange={e => setConfig(prev => ({ ...prev, sensorStyle: e.target.value }))}
                      >
                        <option value="radial-gauge">Radial Humidity Gauge</option>
                        <option value="compact-chip">Compact Humidity Chip</option>
                        <option value="dual-sensor">Dual Sensor (Temp + Humidity)</option>
                      </select>
                    </label>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={config.showComfortIndex !== false}
                        onChange={e => setConfig(prev => ({ ...prev, showComfortIndex: e.target.checked }))}
                      />
                      Show comfort index badge (Dry / Optimal / Humid)
                    </label>
                  </>
                )}
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

          <div className="dialog-preview-col">
            <p className="kicker">LIVE GLASS PREVIEW</p>
            <div className="live-preview-box">
              {PreviewComponent && (
                <PreviewComponent
                  widgetId={widget.id}
                  data={data}
                  state="ready"
                  editing={false}
                  configuration={config}
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

type CatalogCategory = 'all' | 'weather' | 'time' | 'notifications' | 'bookmarks' | 'search' | 'system'

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
  },
  'weather-forecast': {
    category: 'weather',
    title: 'Weather & Forecast',
    subtitle: 'Current Sky & 12h Strip',
    description: 'Live temperature, wind, precipitation chance, and hourly forecast powered by Open-Meteo.',
    icon: 'activity'
  },
  'environment-sensor': {
    category: 'weather',
    title: 'Humidity & Comfort',
    subtitle: 'Environmental Gauge',
    description: 'Relative humidity dial, dew point, and comfort index badge for outdoor or room monitoring.',
    icon: 'activity'
  }
}

export function WidgetCatalog({
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
    { key: 'weather', label: 'Weather' },
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

        <div className="catalog-grid">
          {filtered.map(definition => {
            const meta = CATALOG_METADATA[definition.type] ?? {
              category: 'system' as CatalogCategory,
              title: definition.type.replaceAll('-', ' '),
              subtitle: 'Widget',
              description: 'HomeDash dashboard widget.',
              icon: 'grid' as IconName
            }

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
