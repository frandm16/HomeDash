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
