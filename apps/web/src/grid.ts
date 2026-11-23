import type { GridLayout, Widget } from './api'

export const GRID_COLUMNS = 16
export const GRID_ROWS = 16

export function normalizeLayout(layout: GridLayout, minSize: { width: number; height: number }): GridLayout {
  const width = Math.max(minSize.width, Math.min(GRID_COLUMNS, Math.round(layout.width)))
  const height = Math.max(minSize.height, Math.min(GRID_ROWS, Math.round(layout.height)))
  return {
    x: Math.max(0, Math.min(GRID_COLUMNS - width, Math.round(layout.x))),
    y: Math.max(0, Math.min(GRID_ROWS - height, Math.round(layout.y))),
    width,
    height
  }
}

export function overlaps(a: GridLayout, b: GridLayout): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

function findFreeLayout(layout: GridLayout, occupied: GridLayout[], minY = layout.y): GridLayout | null {
  for (let y = minY; y <= GRID_ROWS - layout.height; y += 1) {
    for (let x = 0; x <= GRID_COLUMNS - layout.width; x += 1) {
      const candidate = { ...layout, x, y }
      if (!occupied.some(item => overlaps(candidate, item))) return candidate
    }
  }
  for (let y = 0; y < minY; y += 1) {
    for (let x = 0; x <= GRID_COLUMNS - layout.width; x += 1) {
      const candidate = { ...layout, x, y }
      if (!occupied.some(item => overlaps(candidate, item))) return candidate
    }
  }
  // Fallback si la pantalla está muy llena
  return { ...layout, x: 0, y: GRID_ROWS - 1 }
}

export function moveWidget(widgets: Widget[], id: string, layout: GridLayout, minSize: { width: number; height: number }): Widget[] {
  const target = normalizeLayout(layout, minSize)
  const active = widgets.filter(widget => widget.isEnabled)
  const moving = active.find(widget => widget.id === id)
  if (!moving) return widgets
  const placed: Widget[] = [{ ...moving, layout: target }]
  const others = active.filter(widget => widget.id !== id).sort((a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x)
  for (const widget of others) {
    const normalized = normalizeLayout(widget.layout, { width: 1, height: 1 })
    const resolved = placed.some(item => overlaps(normalized, item.layout))
      ? findFreeLayout(normalized, placed.map(item => item.layout), normalized.y)
      : normalized
    if (!resolved) return widgets
    placed.push({ ...widget, layout: resolved })
  }
  const layouts = new Map(placed.map(widget => [widget.id, widget.layout]))
  return widgets.map(widget => layouts.has(widget.id) ? { ...widget, layout: layouts.get(widget.id)! } : widget)
}

export function findOpenLayout(layout: GridLayout, widgets: Widget[], ignoreId?: string): GridLayout {
  const candidate = normalizeLayout(layout, { width: 1, height: 1 })
  const occupied = widgets.filter(widget => widget.isEnabled && widget.id !== ignoreId).map(widget => widget.layout)
  if (!occupied.some(item => overlaps(candidate, item))) {
    return candidate
  }
  return findFreeLayout(candidate, occupied, candidate.y) ?? { ...candidate, y: 0 }
}

export function placeWidget(widgets: Widget[], widget: Widget, minSize: { width: number; height: number }): Widget[] {
  const candidate = normalizeLayout(widget.layout, minSize)
  const layout = findFreeLayout(candidate, widgets.filter(item => item.isEnabled).map(item => item.layout), candidate.y)
  return layout ? [...widgets, { ...widget, layout, isEnabled: true }] : widgets
}
