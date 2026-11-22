import assert from 'node:assert/strict'
import test from 'node:test'
import { metricsText, incrementMetric, observeMetric, resetMetrics } from './observability.js'
import { redactAuditMetadata } from './audit.js'

test('metrics expose counters and histograms with bounded labels', () => {
  resetMetrics()
  incrementMetric('requests_total', { route: '/secret?token=hidden' })
  observeMetric('request_duration_seconds', 0.25, { method: 'GET' })
  const output = metricsText()
  assert.match(output, /requests_total\{route="\/secret\?token=hidden"\} 1/)
  assert.match(output, /request_duration_seconds_count\{method="GET"\} 1/)
  assert.match(output, /request_duration_seconds_sum\{method="GET"\} 0\.25/)
})

test('audit metadata redacts secrets recursively without changing safe values', () => {
  assert.deepEqual(redactAuditMetadata({ username: 'alice', password: 'nope', nested: { apiKey: 'hidden' }, items: [{ token: 'secret' }] }), {
    username: 'alice', password: '[REDACTED]', nested: { apiKey: '[REDACTED]' }, items: [{ token: '[REDACTED]' }],
  })
})
