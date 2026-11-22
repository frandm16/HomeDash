import assert from 'node:assert/strict'
import test from 'node:test'
import { createNotificationCenterAdapter } from './notification-center.js'

test('Notification Center adapter normalizes API notifications', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), 'http://notification-center.test/api/v1/notifications')
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer read-token')
    return new Response(JSON.stringify({ notifications: [{ id: 42, source: 'proxmox', title: 'Backup', body: 'Done', level: 'success', isRead: true, createdAt: '2026-11-22T08:30:00.000Z' }] }), { status: 200 })
  }

  try {
    const adapter = createNotificationCenterAdapter({ baseUrl: 'http://notification-center.test', readToken: 'read-token', timeoutMs: 1000 })
    const notifications = await adapter.getNotifications()
    assert.deepEqual(notifications[0], {
      id: '42',
      source: 'proxmox',
      title: 'Backup',
      body: 'Done',
      level: 'SUCCESS',
      read: true,
      createdAt: '2026-11-22T08:30:00.000Z',
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})
