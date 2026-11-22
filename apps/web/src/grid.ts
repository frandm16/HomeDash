import type { GridLayout, Widget } from './api'

export const GRID_COLUMNS = 8
export function normalizeLayout(layout: GridLayout, minSize: { width: number; height: number }): GridLayout {
  const width = Math.max(minSize.width, Math.min(GRID_COLUMNS, Math.round(layout.width)))
  const height = Math.max(minSize.height, Math.round(layout.height))
  return { x: Math.max(0, Math.min(GRID_COLUMNS - width, Math.round(layout.x))), y: Math.max(0, Math.round(layout.y)), width, height }
}
export function overlaps(a: GridLayout, b: GridLayout): boolean { return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y }
export function moveWidget(widgets: Widget[], id: string, layout: GridLayout, minSize: { width: number; height: number }): Widget[] {
  const target = normalizeLayout(layout, minSize)
  const occupied = widgets.filter((widget) => widget.id !== id && widget.isEnabled)
  let candidate = target
  while (occupied.some((widget) => overlaps(candidate, widget.layout))) candidate = { ...candidate, y: candidate.y + 1 }
  return widgets.map((widget) => widget.id === id ? { ...widget, layout: candidate } : widget)
}
