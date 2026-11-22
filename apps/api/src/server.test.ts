import assert from 'node:assert/strict'
import test from 'node:test'
import { getSnapshot } from './snapshot.js'

test('dashboard snapshot exposes the normalized service and notification contracts', () => {
  const snapshot = getSnapshot()

  assert.equal(snapshot.services.length, 4)
  assert.equal(snapshot.notifications.length, 3)
  assert.equal(snapshot.unreadNotifications, 3)
  assert.equal(snapshot.notifications[0]?.level, 'SUCCESS')
})
