import assert from 'node:assert/strict'
import test from 'node:test'
import { collectPerformanceSnapshot } from './performance.js'

test('performance adapter collects real host metrics with storage and history buffer', async () => {
  const snapshot = await collectPerformanceSnapshot()

  assert.equal(snapshot.sourceState, 'ready')
  assert.equal(snapshot.provider, 'local')
  assert.ok(Array.isArray(snapshot.metrics))
  assert.equal(snapshot.metrics.length, 3)

  const cpu = snapshot.metrics.find(m => m.key === 'cpu')
  const ram = snapshot.metrics.find(m => m.key === 'ram')
  const storage = snapshot.metrics.find(m => m.key === 'storage')

  assert.ok(cpu && typeof cpu.value === 'number')
  assert.ok(ram && typeof ram.value === 'number')
  assert.ok(storage && typeof storage.value === 'number')

  assert.ok(cpu.value >= 0 && cpu.value <= 100)
  assert.ok(ram.value >= 0 && ram.value <= 100)
  assert.ok(storage.value >= 0 && storage.value <= 100)

  assert.ok(Array.isArray(snapshot.nodes))
  assert.equal(snapshot.nodes.length, 1)
  assert.equal(snapshot.nodes[0].kind, 'host')

  assert.ok(Array.isArray(snapshot.history))
  assert.ok(snapshot.history.length >= 1)
  assert.ok(typeof snapshot.history[0].timestamp === 'string')
})
