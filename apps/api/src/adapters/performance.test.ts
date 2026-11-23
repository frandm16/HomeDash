import assert from 'node:assert/strict'
import test from 'node:test'
import { collectPerformanceSnapshot } from './performance.js'

test('performance adapter collects real host metrics with history buffer', async () => {
  const snapshot = await collectPerformanceSnapshot()

  assert.equal(snapshot.sourceState, 'ready')
  assert.ok(Array.isArray(snapshot.metrics))
  assert.ok(snapshot.metrics.length >= 3)

  const cpu = snapshot.metrics.find(m => m.key === 'cpu')
  const ram = snapshot.metrics.find(m => m.key === 'ram')
  const gpu = snapshot.metrics.find(m => m.key === 'gpu')

  assert.ok(cpu && typeof cpu.value === 'number')
  assert.ok(ram && typeof ram.value === 'number')
  assert.ok(gpu && typeof gpu.value === 'number')

  assert.ok(cpu.value >= 0 && cpu.value <= 100)
  assert.ok(ram.value >= 0 && ram.value <= 100)
  assert.ok(gpu.value >= 0 && gpu.value <= 100)

  assert.ok(Array.isArray(snapshot.history))
  assert.ok(snapshot.history.length > 0)
  assert.ok(typeof snapshot.history[0].timestamp === 'string')
})
