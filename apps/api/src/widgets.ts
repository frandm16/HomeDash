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
  { type: 'search', version: 1, defaultConfiguration: { provider: 'google', openInNewTab: true }, minSize: { w: 1, h: 1 }, initialSize: { w: 4, h: 1 }, permissions: [] },
  { type: 'service-status', version: 1, defaultConfiguration: {}, minSize: { w: 1, h: 1 }, initialSize: { w: 3, h: 2 }, permissions: ['service:read'], refreshIntervalMs: 30_000 },
  { type: 'notifications', version: 1, defaultConfiguration: {}, minSize: { w: 1, h: 1 }, initialSize: { w: 3, h: 3 }, permissions: ['notification:read'], refreshIntervalMs: 30_000 },
  { type: 'bookmarks', version: 1, defaultConfiguration: {}, minSize: { w: 1, h: 1 }, initialSize: { w: 4, h: 2 }, permissions: ['bookmark:read'] },
  { type: 'homelab-performance', version: 1, defaultConfiguration: {}, minSize: { w: 1, h: 1 }, initialSize: { w: 2, h: 2 }, permissions: ['metrics:read'], refreshIntervalMs: 15_000 },
]

export function listWidgetDefinitions(): WidgetDefinition[] { return definitions }
export function getWidgetDefinition(type: string): WidgetDefinition | undefined { return definitions.find((definition) => definition.type === type) }
export function isWidgetTypeAllowed(type: string): boolean { return Boolean(getWidgetDefinition(type)) }
