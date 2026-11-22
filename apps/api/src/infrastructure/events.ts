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

export function subscribeEvents(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function publishEvent(event: Omit<HomeDashEvent, 'id' | 'version' | 'occurredAt'>): HomeDashEvent {
  const normalized: HomeDashEvent = { ...event, id: randomUUID(), version: 1, occurredAt: new Date().toISOString() }
  for (const listener of listeners) listener(normalized)
  return normalized
}

export function heartbeatEvent(): HomeDashEvent {
  return { id: randomUUID(), type: 'heartbeat', version: 1, occurredAt: new Date().toISOString(), source: 'homedash' }
}
