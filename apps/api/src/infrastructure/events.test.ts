import assert from 'node:assert/strict'
import test from 'node:test'
import { heartbeatEvent, publishEvent, subscribeEvents } from './events.js'

test('event bus publishes normalized events and unsubscribes listeners', () => {
  const events: unknown[] = []
  const unsubscribe = subscribeEvents((event) => events.push(event))
  const published = publishEvent({ type: 'service.status.changed', source: 'service-health', payload: { status: 'online' } })
  unsubscribe()
  publishEvent({ type: 'notification.created', source: 'notification-center', payload: { id: 'n-1' } })

  assert.equal(events.length, 1)
  assert.equal((events[0] as typeof published).id, published.id)
  assert.equal(published.version, 1)
  assert.equal(heartbeatEvent().type, 'heartbeat')
})
