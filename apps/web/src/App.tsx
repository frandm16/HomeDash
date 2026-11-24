import { Component, lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ErrorInfo, PointerEvent, ReactNode } from 'react'
import {
  ApiError,
  consumeInitialBootstrap,
  deleteBookmark,
  deleteWidget,
  fetchBootstrap,
  fetchDashboard,
  fetchPerformance,
  fetchWidgetDefinitions,
  logout,
  openEvents,
  updateBookmark,
  updateWidget,
  createWidget,
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
import { Icon } from './Icon'
import { widgetRegistry } from './widgets/registry'
import type { WidgetData, WidgetRenderProps } from './widgets/types'
import './App.css'

type ToastState = 'saved' | 'saving' | 'error'

const LazyLoginScreen = lazy(() => import('./LoginScreen'))
const loadEditOverlays = () => import('./EditOverlays')
const LazyBookmarkDialog = lazy(() => loadEditOverlays().then(m => ({ default: m.BookmarkDialog })))
const LazyWidgetSettings = lazy(() => loadEditOverlays().then(m => ({ default: m.WidgetSettings })))
const LazyWidgetCatalog = lazy(() => loadEditOverlays().then(m => ({ default: m.WidgetCatalog })))

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

class WidgetErrorBoundary extends Component<
  { widgetType: string; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[HomeDash] Widget "${this.props.widgetType}" failed to render:`, error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="widget-card widget-error-card" role="alert">
          <p className="widget-status">
            <i className="status-lamp offline"/>
            This widget couldn&apos;t render.
          </p>
          <button
            type="button"
            className="button button-quiet widget-retry-btn"
            onClick={() => this.setState({ hasError: false })}
          >
            Retry
          </button>
        </section>
      )
    }
    return this.props.children
  }
}

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
  const [saveState, setSaveState] = useState<ToastState>('saved')
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const showToast = useCallback((state: ToastState, message: string, durationMs?: number) => {
    setSaveState(state)
    setToastMessage(message)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    if (durationMs) {
      toastTimer.current = window.setTimeout(() => {
        setToastMessage(null)
      }, durationMs)
    }
  }, [])

  useEffect(() => () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
  }, [])

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
    if (editing) void loadEditOverlays()
  }, [editing])

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
    showToast('saving', 'Saving changes…')
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
        showToast('saved', 'Changes saved', 1800)
      }).catch(() => showToast('error', 'Could not save layout changes', 4500))
    }, 450)
  }, [showToast])

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
      showToast('saved', 'Widget added', 1800)
    } catch {
      showToast('error', 'Could not add widget', 4500)
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
      showToast('saved', 'Widget removed', 1800)
    } catch {
      deletedWidgetIdsRef.current.delete(widget.id)
      setWidgets(previousWidgets)
      writeCache({ widgets: previousWidgets })
      showToast('error', 'Could not remove widget', 4500)
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
      showToast('saved', 'Bookmark removed', 1800)
    } catch {
      showToast('error', 'Could not remove bookmark', 4500)
    }
  }, [showToast])

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
      showToast('error', 'Could not reorder bookmarks', 4500)
    }
  }, [bookmarks, showToast])

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
      <div className="corner-hotzone" ref={menuRef} onPointerEnter={() => void loadEditOverlays()}>
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
                {definition && (
                  <WidgetErrorBoundary key={`${widget.id}:${widget.updatedAt ?? ''}`} widgetType={widget.widgetType}>
                    <WidgetRenderer definition={definition} props={props}/>
                  </WidgetErrorBoundary>
                )}
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
              <span aria-hidden="true">+</span>
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

      {toastMessage && (
        <div
          className={`save-toast state-${saveState}`}
          role={saveState === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          <span className="save-toast-dot" aria-hidden="true"/>
          <span>{toastMessage}</span>
          {saveState === 'error' && (
            <button
              type="button"
              className="save-toast-dismiss"
              onClick={() => setToastMessage(null)}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          )}
        </div>
      )}

      <Suspense fallback={null}>
        {showCatalog && (
          <LazyWidgetCatalog
            definitions={definitions}
            widgets={widgets}
            selectedSlot={selectedSlot}
            onClose={() => { setShowCatalog(false); setSelectedSlot(null) }}
            onAdd={addWidget}
          />
        )}

        {bookmarkDialog && profile && (
          <LazyBookmarkDialog
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
          <LazyWidgetSettings
            widget={settingsWidget}
            data={data}
            onClose={() => setSettingsWidget(null)}
            onSave={configuration => updateConfiguration(settingsWidget, configuration)}
          />
        )}
      </Suspense>
    </main>
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
      <Suspense
        fallback={
          <main className="login-page">
            <div className="login-card loading-card">
              <span className="brand-symbol"><Icon name="grid"/></span>
              <p>Loading…</p>
            </div>
          </main>
        }
      >
        <LazyLoginScreen
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
      </Suspense>
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
