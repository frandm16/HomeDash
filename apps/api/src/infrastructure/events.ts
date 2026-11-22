import { randomUUID } from 'node:crypto'

export type HomeDashEvent = {
  id: string
  type: 'heartbeat' | 'notification.created' | 'service.status.changed'
  version: 1
  occurredAt: string
  source: string
  payload?: unknown
}

type Listener = (event: HomeDashEvent) => void
const listeners = new Set<Listener>()
const recentEvents: HomeDashEvent[] = []
const maxRecentEvents = 100

export function subscribeEvents(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function publishEvent(event: Omit<HomeDashEvent, 'id' | 'version' | 'occurredAt'>): HomeDashEvent {
  const normalized: HomeDashEvent = { ...event, id: randomUUID(), version: 1, occurredAt: new Date().toISOString() }
  recentEvents.push(normalized)
  if (recentEvents.length > maxRecentEvents) recentEvents.shift()
  for (const listener of listeners) listener(normalized)
  return normalized
}

export function replayAfter(lastEventId?: string): HomeDashEvent[] {
  if (!lastEventId) return [...recentEvents]
  const index = recentEvents.findIndex((event) => event.id === lastEventId)
  return index < 0 ? [] : recentEvents.slice(index + 1)
}

export function heartbeatEvent(): HomeDashEvent {
  return { id: randomUUID(), type: 'heartbeat', version: 1, occurredAt: new Date().toISOString(), source: 'homedash' }
}
