import { BookmarksWidget, SingleBookmarkWidget } from './bookmarks'
import { NotificationsWidget } from './notifications'
import { PerformanceWidget, ServicesWidget } from './performance'
import { SearchWidget } from './search'
import type { WidgetDefinition } from './types'
import { ClockHeroWidget, CountdownEventWidget, StickyNoteWidget } from './utilities'
import { EnvironmentSensorWidget, WeatherForecastWidget } from './weather'

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
  'single-bookmark': {
    type: 'single-bookmark',
    version: 1,
    defaultSize: { width: 2, height: 2 },
    minSize: { width: 1, height: 1 },
    configuration: { bookmarkId: '', title: '', url: '', icon: '', subtitle: '', openInNewTab: true },
    render: SingleBookmarkWidget
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
  },
  'clock-hero': {
    type: 'clock-hero',
    version: 1,
    defaultSize: { width: 3, height: 2 },
    minSize: { width: 1, height: 1 },
    configuration: { clockStyle: 'digital-modern', showSeconds: false, format24h: true },
    render: ClockHeroWidget
  },
  'countdown-event': {
    type: 'countdown-event',
    version: 1,
    defaultSize: { width: 3, height: 2 },
    minSize: { width: 1, height: 1 },
    configuration: { title: 'Target Event', targetDate: '', icon: '🎯', countdownStyle: 'hero-counter' },
    render: CountdownEventWidget
  },
  'sticky-note': {
    type: 'sticky-note',
    version: 1,
    defaultSize: { width: 2, height: 2 },
    minSize: { width: 1, height: 1 },
    configuration: { noteType: 'text', content: '', pinColor: 'blue' },
    render: StickyNoteWidget
  },
  'weather-forecast': {
    type: 'weather-forecast',
    version: 1,
    defaultSize: { width: 3, height: 2 },
    minSize: { width: 1, height: 1 },
    configuration: { locationName: 'Madrid', latitude: 40.42, longitude: -3.7, units: 'metric', weatherStyle: 'card-detailed' },
    render: WeatherForecastWidget
  },
  'environment-sensor': {
    type: 'environment-sensor',
    version: 1,
    defaultSize: { width: 2, height: 2 },
    minSize: { width: 1, height: 1 },
    configuration: { locationName: 'Madrid', latitude: 40.42, longitude: -3.7, units: 'metric', source: 'open-meteo', showComfortIndex: true, sensorStyle: 'radial-gauge' },
    render: EnvironmentSensorWidget
  }
}
