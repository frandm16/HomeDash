import assert from 'node:assert/strict'
import test from 'node:test'
import { createSnapshotService } from './snapshot.js'

test('dashboard snapshot exposes the normalized service and notification contracts', async () => {
  const source = {
    getNotifications: async () => [{
      id: 'nc-1',
      source: 'proxmox',
      title: 'Backup complete',
      body: 'VM 200',
      level: 'SUCCESS' as const,
      read: false,
      createdAt: '2026-11-22T08:30:00.000Z',
    }],
    getUnreadCount: async () => 1,
  }
  const snapshot = await createSnapshotService({ notifications: source }).getSnapshot()

  assert.equal(snapshot.services.length, 4)
  assert.equal(snapshot.notifications.length, 1)
  assert.equal(snapshot.unreadNotifications, 1)
  assert.equal(snapshot.notifications[0]?.level, 'SUCCESS')
})
