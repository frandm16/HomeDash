import type * as React from 'react'
import type { Bookmark, DashboardNotification, PerformanceSnapshot, Service } from '../api'

export type WidgetData = {
  services: Service[]
  notifications: DashboardNotification[]
  unreadNotifications: number
  bookmarks: Bookmark[]
  performance: PerformanceSnapshot | null
}

export type WidgetRenderProps = {
  widgetId?: string
  data: WidgetData
  state: 'loading' | 'ready' | 'empty' | 'offline' | 'stale' | 'error'
  message?: string
  editing?: boolean
  configuration?: Record<string, unknown>
  onConfigurationChange?: (configuration: Record<string, unknown>) => void
  onBookmarkChange?: () => void
  onBookmarkDelete?: (bookmark: Bookmark) => void
  onBookmarkEdit?: (bookmark: Bookmark) => void
  onBookmarkReorder?: (orderedIds: string[]) => void
}

export type WidgetDefinition = {
  type: string
  version: number
  defaultSize: { width: number; height: number }
  minSize: { width: number; height: number }
  configuration: Record<string, unknown>
  render: (props: WidgetRenderProps) => React.ReactNode
}

export const WIDGET_ACCENT_MAP: Record<string, string> = {
  default: '#6ea8ff',
  purple: '#a78bfa',
  emerald: '#34d399',
  amber: '#fbbf24',
  rose: '#fb7185',
  cyan: '#22d3ee',
}

export const WIDGET_BG_LABELS: Record<string, string> = {
  glass: 'Liquid Glass',
  transparent: 'Transparent',
  solid: 'Solid Dark',
  tinted: 'Tinted Accent',
}

export function getWidgetAppearance(configuration?: Record<string, unknown>): {
  bgStyle: string
  bgLabel: string
  styleVars: React.CSSProperties
} {
  const bgStyle = String(configuration?.backgroundStyle ?? 'glass')
  const accentColor = String(configuration?.accentColor ?? 'default')
  const accentHex = WIDGET_ACCENT_MAP[accentColor] ?? WIDGET_ACCENT_MAP.default
  const styleVars: React.CSSProperties = accentColor !== 'default'
    ? ({ '--accent': accentHex, '--accent-soft': `${accentHex}33` } as React.CSSProperties)
    : {}
  return {
    bgStyle,
    bgLabel: WIDGET_BG_LABELS[bgStyle] ?? 'Liquid Glass',
    styleVars,
  }
}
