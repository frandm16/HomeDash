import assert from 'node:assert/strict'
import test from 'node:test'
import { checkService } from './service-health.js'

test('service health rejects credential-bearing URLs safely', async () => {
  const result = await checkService({ id: 'one', url: 'http://user:password@127.0.0.1' })
  assert.equal(result.status, 'offline')
  assert.match(result.error ?? '', /credential-free/)
})
