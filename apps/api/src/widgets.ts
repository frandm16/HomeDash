export type WidgetState = 'loading' | 'ready' | 'empty' | 'offline' | 'stale' | 'error'

export type WidgetDefinition = {
  type: string
  version: number
  defaultConfiguration: Record<string, unknown>
  minSize: { w: number; h: number }
  initialSize: { w: number; h: number }
  permissions: string[]
  refreshIntervalMs?: number
}

const definitions: WidgetDefinition[] = [
  // Search
  { type: 'search', version: 1, defaultConfiguration: { provider: 'google', searchStyle: 'pill', openInNewTab: true, showEngineIcon: true }, minSize: { w: 1, h: 1 }, initialSize: { w: 4, h: 1 }, permissions: [] },
  { type: 'search-compact', version: 1, defaultConfiguration: { provider: 'google', searchStyle: 'compact', openInNewTab: true, showEngineIcon: true }, minSize: { w: 1, h: 1 }, initialSize: { w: 2, h: 1 }, permissions: [] },

  // Bookmarks
  { type: 'bookmarks', version: 1, defaultConfiguration: { bookmarkStyle: 'tiles', iconSize: 'normal' }, minSize: { w: 1, h: 1 }, initialSize: { w: 3, h: 2 }, permissions: ['bookmark:read'] },
  { type: 'bookmarks-icons', version: 1, defaultConfiguration: { bookmarkStyle: 'icons-only', iconSize: 'normal' }, minSize: { w: 1, h: 1 }, initialSize: { w: 2, h: 2 }, permissions: ['bookmark:read'] },
  { type: 'bookmarks-dock', version: 1, defaultConfiguration: { bookmarkStyle: 'dock', iconSize: 'normal' }, minSize: { w: 1, h: 1 }, initialSize: { w: 4, h: 1 }, permissions: ['bookmark:read'] },
  { type: 'single-bookmark', version: 1, defaultConfiguration: { bookmarkId: '', title: '', url: '', icon: '', subtitle: '', openInNewTab: true }, minSize: { w: 1, h: 1 }, initialSize: { w: 2, h: 2 }, permissions: ['bookmark:read'] },

  // Notifications
  { type: 'notifications', version: 1, defaultConfiguration: { notificationStyle: 'cards', maxItems: 6 }, minSize: { w: 1, h: 1 }, initialSize: { w: 3, h: 3 }, permissions: ['notification:read'], refreshIntervalMs: 30_000 },
  { type: 'notifications-badge', version: 1, defaultConfiguration: { notificationStyle: 'badge-only' }, minSize: { w: 1, h: 1 }, initialSize: { w: 1, h: 1 }, permissions: ['notification:read'], refreshIntervalMs: 30_000 },
  { type: 'notifications-ticker', version: 1, defaultConfiguration: { notificationStyle: 'compact-ticker' }, minSize: { w: 1, h: 1 }, initialSize: { w: 3, h: 1 }, permissions: ['notification:read'], refreshIntervalMs: 30_000 },

  // System & Infrastructure
  { type: 'homelab-performance', version: 1, defaultConfiguration: { perfStyle: 'radial-gauges' }, minSize: { w: 1, h: 1 }, initialSize: { w: 3, h: 2 }, permissions: ['metrics:read'], refreshIntervalMs: 5_000 },
  { type: 'performance-graph', version: 1, defaultConfiguration: { perfStyle: 'time-series-graph' }, minSize: { w: 1, h: 1 }, initialSize: { w: 4, h: 2 }, permissions: ['metrics:read'], refreshIntervalMs: 5_000 },
  { type: 'performance-kpi', version: 1, defaultConfiguration: { perfStyle: 'kpi-stats' }, minSize: { w: 1, h: 1 }, initialSize: { w: 2, h: 1 }, permissions: ['metrics:read'], refreshIntervalMs: 5_000 },
  { type: 'service-status', version: 1, defaultConfiguration: {}, minSize: { w: 1, h: 1 }, initialSize: { w: 3, h: 2 }, permissions: ['service:read'], refreshIntervalMs: 30_000 },

  // Time & Productivity Utilities (Phase 1)
  { type: 'clock-hero', version: 1, defaultConfiguration: { clockStyle: 'digital-modern', showSeconds: false, format24h: true }, minSize: { w: 1, h: 1 }, initialSize: { w: 3, h: 2 }, permissions: [] },
  { type: 'countdown-event', version: 1, defaultConfiguration: { title: 'Target Event', targetDate: '', icon: '🎯', countdownStyle: 'hero-counter' }, minSize: { w: 1, h: 1 }, initialSize: { w: 3, h: 2 }, permissions: [] },
  { type: 'sticky-note', version: 1, defaultConfiguration: { noteType: 'text', content: '', pinColor: 'blue' }, minSize: { w: 1, h: 1 }, initialSize: { w: 2, h: 2 }, permissions: [] },
]

export function listWidgetDefinitions(): WidgetDefinition[] { return definitions }
export function getWidgetDefinition(type: string): WidgetDefinition | undefined { return definitions.find((definition) => definition.type === type) }
export function isWidgetTypeAllowed(type: string): boolean { return Boolean(getWidgetDefinition(type)) }
