import assert from 'node:assert/strict'
import test from 'node:test'
import { createFaviconService, isPublicFaviconDomain } from './favicons.js'

test('favicon validator rejects private hosts, IPs and malformed domains', () => {
  assert.equal(isPublicFaviconDomain('github.com'), true)
  assert.equal(isPublicFaviconDomain('sub.proxmox.com'), true)
  assert.equal(isPublicFaviconDomain('localhost'), false)
  assert.equal(isPublicFaviconDomain('192.168.1.50'), false)
  assert.equal(isPublicFaviconDomain('proxmox.lan'), false)
  assert.equal(isPublicFaviconDomain('nas.local'), false)
  assert.equal(isPublicFaviconDomain('http://github.com'), false)
})

test('favicon service caches upstream icons and deduplicates concurrent requests', async () => {
  let upstreamCalls = 0
  const fakePng = new Uint8Array([137, 80, 78, 71])
  const service = createFaviconService(async () => {
    upstreamCalls += 1
    return new Response(fakePng, {
      status: 200,
      headers: { 'content-type': 'image/png' },
    })
  })

  const [first, second] = await Promise.all([
    service.getFavicon('GitHub.com'),
    service.getFavicon('github.com'),
  ])
  assert.equal(upstreamCalls, 1)
  assert.ok(first)
  assert.equal(first?.contentType, 'image/png')
  assert.equal(first?.body.byteLength, 4)
  assert.equal(second?.body.byteLength, 4)

  const cached = await service.getFavicon('github.com')
  assert.equal(upstreamCalls, 1)
  assert.equal(cached?.body.byteLength, 4)
})
