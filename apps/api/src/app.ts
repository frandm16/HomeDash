import Fastify, { type FastifyInstance } from 'fastify'
import { randomUUID } from 'node:crypto'
import { heartbeatEvent, subscribeEvents } from './infrastructure/events.js'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import { config } from './config.js'
import { pool } from './db.js'
import { createBookmark, createDashboard, createWidget, deleteBookmark, deleteDashboard, deleteWidget, listBookmarks, listDashboards, listProfiles, listWidgets, updateBookmark, updateDashboard, updateProfile, updateWidget } from './infrastructure/db/repositories/dashboard.js'
import { createDevelopmentSources, createSnapshotService } from './snapshot.js'
import { authenticate, clearSessionCookie, createSession, getSession, requireAuth, revokeAllSessions, revokeSession, SESSION_COOKIE, setSessionCookie, verifyCsrf } from './auth.js'

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
    },
    bodyLimit: 16 * 1024,
    requestIdHeader: 'x-request-id',
    genReqId: () => randomUUID(),
  })
  await app.register(cookie)
  await app.register(cors, { origin: config.corsOrigin, credentials: true })
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' })
  const snapshotService = createSnapshotService(createDevelopmentSources())

  app.setErrorHandler((error, request, reply) => {
    const fastifyError = error as { validation?: unknown; statusCode?: number }
    if (fastifyError.validation) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', requestId: request.id } })
    }
    request.log.error(error)
    return reply.code(fastifyError.statusCode && fastifyError.statusCode >= 400 ? fastifyError.statusCode : 500).send({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: request.id },
    })
  })

  app.get('/health', async (_request, reply) => {
    try {
      await pool.query('SELECT 1')
      return { status: 'ok' }
    } catch {
      return reply.code(503).send({ status: 'unavailable' })
    }
  })
  app.get('/health/live', async () => ({ status: 'ok' }))
  app.get('/health/ready', async (_request, reply) => {
    try {
      await pool.query('SELECT 1')
      return { status: 'ready' }
    } catch {
      return reply.code(503).send({ status: 'not_ready' })
    }
  })
  app.get('/metrics', async () => ({ status: 'ok', uptimeSeconds: Math.round(process.uptime()) }))

  app.post('/api/v1/auth/login', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['username', 'password'],
        properties: {
          username: { type: 'string', minLength: 1, maxLength: 120 },
          password: { type: 'string', minLength: 1, maxLength: 256 },
        },
      },
    },
  }, async (request, reply) => {
    const body = request.body as { username: string; password: string }
    if (!body.username || !body.password) {
      return reply.code(400).send({ error: 'Invalid credentials' })
    }
    const user = await authenticate(body.username, body.password)
    if (!user) return reply.code(401).send({ error: 'Invalid credentials' })
    const session = await createSession(user)
    setSessionCookie(reply, session)
    return { user, csrfToken: session.csrfToken }
  })

  app.get('/api/v1/auth/session', async (request, reply) => {
    const session = await getSession(request.cookies[SESSION_COOKIE])
    if (!session) return reply.code(401).send({ error: 'Authentication required' })
    return { user: session.user, expiresAt: session.expiresAt.toISOString(), csrfToken: session.csrfToken }
  })

  app.post('/api/v1/auth/logout', async (request, reply) => {
    const session = await getSession(request.cookies[SESSION_COOKIE])
    if (session && !verifyCsrf(request, session.csrfToken)) return reply.code(403).send({ error: 'CSRF validation failed' })
    await revokeSession(request.cookies[SESSION_COOKIE])
    clearSessionCookie(reply)
    return { ok: true }
  })

  app.post('/api/v1/auth/logout-all', async (request, reply) => {
    const session = await getSession(request.cookies[SESSION_COOKIE])
    if (!session) return reply.code(401).send({ error: 'Authentication required' })
    if (!verifyCsrf(request, session.csrfToken)) return reply.code(403).send({ error: 'CSRF validation failed' })
    await revokeAllSessions(session.user.id)
    clearSessionCookie(reply)
    return { ok: true }
  })

  app.addHook('preHandler', async (request, reply) => {
    if (request.url === '/health' || request.url === '/health/live' || request.url === '/health/ready' || request.url === '/metrics' || request.url.startsWith('/api/v1/auth/')) return
    const session = await requireAuth(request, reply)
    if (session && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) && !verifyCsrf(request, session.csrfToken)) {
      return reply.code(403).send({ error: 'CSRF validation failed' })
    }
  })

  app.get('/api/v1/dashboards', async (request) => ({ dashboards: await listDashboards(request.auth!.user.id) }))
  app.post('/api/v1/dashboards', { schema: { body: { type: 'object', additionalProperties: false, required: ['name'], properties: { name: { type: 'string', minLength: 1, maxLength: 120 } } } } }, async (request, reply) => reply.code(201).send(await createDashboard(request.auth!.user.id, request.body as { name: string })))
  app.patch('/api/v1/dashboards/:dashboardId', { schema: { body: { type: 'object', additionalProperties: false, required: ['name'], properties: { name: { type: 'string', minLength: 1, maxLength: 120 } } } } }, async (request, reply) => { const result = await updateDashboard(request.auth!.user.id, (request.params as { dashboardId: string }).dashboardId, request.body as { name: string }); return result ?? reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Dashboard not found', requestId: request.id } }) })
  app.delete('/api/v1/dashboards/:dashboardId', async (request, reply) => { if (!await deleteDashboard(request.auth!.user.id, (request.params as { dashboardId: string }).dashboardId)) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Dashboard not found or cannot be deleted', requestId: request.id } }); return { ok: true } })
  app.get('/api/v1/profiles', async (request) => ({ profiles: await listProfiles(request.auth!.user.id) }))
  app.get('/api/v1/dashboards/:dashboardId/profiles', async (request) => ({ profiles: await listProfiles(request.auth!.user.id, (request.params as { dashboardId: string }).dashboardId) }))
  app.patch('/api/v1/profiles/:profileId', async (request, reply) => { const result = await updateProfile(request.auth!.user.id, (request.params as { profileId: string }).profileId, request.body as { layoutVersion?: number }); return result ?? reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Profile not found', requestId: request.id } }) })
  app.get('/api/v1/profiles/:profileId/widgets', async (request) => {
    const params = request.params as { profileId: string }
    return { widgets: await listWidgets(request.auth!.user.id, params.profileId) }
  })
  app.post('/api/v1/profiles/:profileId/widgets', {
    schema: { body: { type: 'object', additionalProperties: false, required: ['widgetType'], properties: { widgetType: { type: 'string', minLength: 1, maxLength: 80 }, configuration: {}, layout: {} } } },
  }, async (request, reply) => {
    const params = request.params as { profileId: string }
    const body = request.body as { widgetType: string; configuration?: unknown; layout?: unknown }
    return reply.code(201).send(await createWidget(request.auth!.user.id, params.profileId, body))
  })
  app.patch('/api/v1/widgets/:widgetId', async (request, reply) => { const result = await updateWidget(request.auth!.user.id, (request.params as { widgetId: string }).widgetId, request.body as { configuration?: unknown; layout?: unknown; isEnabled?: boolean }, request.headers['if-unmodified-since']); return result ?? reply.code(409).send({ error: { code: 'CONFLICT', message: 'Widget was modified or not found', requestId: request.id } }) })
  app.delete('/api/v1/widgets/:widgetId', async (request, reply) => {
    const params = request.params as { widgetId: string }
    if (!await deleteWidget(request.auth!.user.id, params.widgetId)) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Widget not found', requestId: request.id } })
    return { ok: true }
  })
  app.get('/api/v1/profiles/:profileId/bookmarks', async (request) => {
    const params = request.params as { profileId: string }
    return { bookmarks: await listBookmarks(request.auth!.user.id, params.profileId) }
  })
  app.post('/api/v1/profiles/:profileId/bookmarks', {
    schema: { body: { type: 'object', additionalProperties: false, required: ['name', 'url'], properties: { name: { type: 'string', minLength: 1, maxLength: 120 }, url: { type: 'string', format: 'uri', maxLength: 2048 }, icon: { type: 'string', maxLength: 120 }, category: { type: 'string', maxLength: 120 } } } },
  }, async (request, reply) => {
    const params = request.params as { profileId: string }
    const body = request.body as { name: string; url: string; icon?: string; category?: string }
    if (!['http:', 'https:'].includes(new URL(body.url).protocol) || new URL(body.url).username || new URL(body.url).password) return reply.code(400).send({ error: { code: 'INVALID_URL', message: 'Only public HTTP and HTTPS URLs are allowed', requestId: request.id } })
    return reply.code(201).send(await createBookmark(request.auth!.user.id, params.profileId, body))
  })
  app.patch('/api/v1/bookmarks/:bookmarkId', async (request, reply) => { const result = await updateBookmark(request.auth!.user.id, (request.params as { bookmarkId: string }).bookmarkId, request.body as { name?: string; url?: string; icon?: string; category?: string; sortOrder?: number }); return result ?? reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Bookmark not found', requestId: request.id } }) })
  app.delete('/api/v1/bookmarks/:bookmarkId', async (request, reply) => { if (!await deleteBookmark(request.auth!.user.id, (request.params as { bookmarkId: string }).bookmarkId)) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Bookmark not found', requestId: request.id } }); return { ok: true } })

  app.get('/api/v1/events', async (request, reply) => {
    if (!request.auth) return reply.code(401).send({ error: 'Authentication required' })
    reply.hijack()
    const response = reply.raw
    response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' })
    const send = (event: ReturnType<typeof heartbeatEvent>) => response.write(`id: ${event.id}\\nevent: ${event.type}\\ndata: ${JSON.stringify(event)}\\n\\n`)
    send(heartbeatEvent())
    const unsubscribe = subscribeEvents(send)
    const heartbeat = setInterval(() => send(heartbeatEvent()), 25_000)
    request.raw.on('close', () => { clearInterval(heartbeat); unsubscribe() })
  })

  app.get('/api/v1/dashboard', async (_request, reply) => {
    try { return await snapshotService.getSnapshot() } catch (error) {
      app.log.error(error)
      return reply.code(502).send({ error: 'Dashboard sources unavailable' })
    }
  })
  app.get('/api/v1/services', async () => {
    const snapshot = await snapshotService.getSnapshot()
    return { services: snapshot.services, sourceState: snapshot.sourceStates?.services }
  })
  app.get('/api/v1/notifications', async (_request, reply) => {
    try {
      const snapshot = await snapshotService.getSnapshot()
      return { notifications: snapshot.notifications, unreadCount: snapshot.unreadNotifications }
    } catch (error) {
      app.log.error(error)
      return reply.code(502).send({ error: 'Notification source unavailable' })
    }
  })
  return app
}
