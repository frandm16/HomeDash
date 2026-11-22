import Fastify, { type FastifyInstance } from 'fastify'
import { randomUUID } from 'node:crypto'
import { heartbeatEvent, replayAfter, subscribeEvents } from './infrastructure/events.js'
import { isWidgetTypeAllowed, listWidgetDefinitions } from './widgets.js'
import { bookmarkBody, bookmarkPatchBody, dashboardNameBody, serviceBody, servicePatchBody, widgetBody } from './contracts.js'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import { config } from './config.js'
import { pool } from './db.js'
import * as dashboardRepository from './infrastructure/db/repositories/dashboard.js'
import { createService, deleteService, listAllServices, listServices, updateService } from './infrastructure/db/repositories/services.js'
import { checkServices } from './adapters/service-health.js'
import { createDevelopmentSources, createSnapshotService } from './snapshot.js'
import * as authService from './auth.js'
import { recordAudit as defaultRecordAudit } from './infrastructure/audit.js'
import { incrementMetric, metricsText, observeMetric } from './infrastructure/observability.js'

export type AppDependencies = {
  auth?: Pick<typeof authService, 'authenticate' | 'createSession' | 'getSession' | 'revokeAllSessions' | 'revokeSession' | 'requireAuth'>
  dashboard?: typeof dashboardRepository
  recordAudit?: typeof defaultRecordAudit
}

export async function buildApp(dependencies: AppDependencies = {}): Promise<FastifyInstance> {
  const auth = dependencies.auth ?? authService
  const dashboard = dependencies.dashboard ?? dashboardRepository
  const recordAudit = dependencies.recordAudit ?? defaultRecordAudit
  const { clearSessionCookie, setSessionCookie, verifyCsrf, SESSION_COOKIE } = authService
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
  app.addHook('onSend', async (request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff')
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin')
    reply.header('X-Frame-Options', 'DENY')
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    reply.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'")
    if (config.isProduction) reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  })
  const snapshotService = createSnapshotService(createDevelopmentSources())

  app.addHook('onResponse', async (request, reply) => {
    const route = request.routeOptions.url ?? 'unknown'
    incrementMetric('homedash_http_requests_total', { method: request.method, route, status: String(reply.statusCode) })
    observeMetric('homedash_http_request_duration_seconds', reply.elapsedTime / 1000, { method: request.method, route })
  })

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
      const result = await pool.query<{ applied: boolean }>(`SELECT EXISTS (
        SELECT 1 FROM schema_migrations WHERE version = 3
      ) AS applied`)
      if (!result.rows[0]?.applied) return reply.code(503).send({ status: 'not_ready', checks: { database: 'ready', migrations: 'pending' } })
      return { status: 'ready', checks: { database: 'ready', migrations: 'ready' } }
    } catch {
      return reply.code(503).send({ status: 'not_ready', checks: { database: 'unavailable', migrations: 'unknown' } })
    }
  })
  app.get('/metrics', async (_request, reply) => {
    reply.type('text/plain; version=0.0.4')
    return metricsText()
  })

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
    const user = await auth.authenticate(body.username, body.password)
    if (!user) return reply.code(401).send({ error: 'Invalid credentials' })
    await recordAudit({ userId: user.id, action: 'login', resourceType: 'session' })
    const session = await auth.createSession(user)
    setSessionCookie(reply, session)
    return { user, csrfToken: session.csrfToken }
  })

  app.get('/api/v1/auth/session', async (request, reply) => {
    const session = await auth.getSession(request.cookies[SESSION_COOKIE])
    if (!session) return reply.code(401).send({ error: 'Authentication required' })
    return { user: session.user, expiresAt: session.expiresAt.toISOString(), csrfToken: request.cookies.homedash_csrf ?? session.csrfToken }
  })

  app.post('/api/v1/auth/logout', async (request, reply) => {
    const session = await auth.getSession(request.cookies[SESSION_COOKIE])
    if (session && !verifyCsrf(request, session)) return reply.code(403).send({ error: 'CSRF validation failed' })
    await auth.revokeSession(request.cookies[SESSION_COOKIE])
    if (session) await recordAudit({ userId: session.user.id, action: 'logout', resourceType: 'session' })
    clearSessionCookie(reply)
    return { ok: true }
  })

  app.post('/api/v1/auth/logout-all', async (request, reply) => {
    const session = await auth.getSession(request.cookies[SESSION_COOKIE])
    if (!session) return reply.code(401).send({ error: 'Authentication required' })
    if (!verifyCsrf(request, session)) return reply.code(403).send({ error: 'CSRF validation failed' })
    await auth.revokeAllSessions(session.user.id)
    clearSessionCookie(reply)
    return { ok: true }
  })

  app.addHook('preHandler', async (request, reply) => {
    if (request.url === '/health' || request.url === '/health/live' || request.url === '/health/ready' || request.url === '/metrics' || request.url.startsWith('/api/v1/auth/')) return
    const session = await auth.requireAuth(request, reply)
    if (session) await authService.touchSession(session)
    if (session && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) && !verifyCsrf(request, session)) {
      return reply.code(403).send({ error: 'CSRF validation failed' })
    }
  })

  app.get('/api/v1/widgets/definitions', async () => ({ widgets: listWidgetDefinitions() }))
  app.get('/api/v1/dashboards', async (request) => ({ dashboards: await dashboard.listDashboards(request.auth!.user.id) }))
  app.post('/api/v1/dashboards', { schema: { body: dashboardNameBody } }, async (request, reply) => { const dashboardResult = await dashboard.createDashboard(request.auth!.user.id, request.body as { name: string }); if (dashboardResult) await recordAudit({ userId: request.auth!.user.id, action: 'create', resourceType: 'dashboard', resourceId: dashboardResult.id }); return reply.code(201).send(dashboardResult) })
  app.patch('/api/v1/dashboards/:dashboardId', { schema: { body: dashboardNameBody } }, async (request, reply) => { const id = (request.params as { dashboardId: string }).dashboardId; const result = await dashboard.updateDashboard(request.auth!.user.id, id, request.body as { name: string }); if (!result) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Dashboard not found', requestId: request.id } }); await recordAudit({ userId: request.auth!.user.id, action: 'update', resourceType: 'dashboard', resourceId: id }); return result })
  app.delete('/api/v1/dashboards/:dashboardId', async (request, reply) => { const id = (request.params as { dashboardId: string }).dashboardId; if (!await dashboard.deleteDashboard(request.auth!.user.id, id)) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Dashboard not found or cannot be deleted', requestId: request.id } }); await recordAudit({ userId: request.auth!.user.id, action: 'delete', resourceType: 'dashboard', resourceId: id }); return { ok: true } })
  app.get('/api/v1/profiles', async (request) => ({ profiles: await dashboard.listProfiles(request.auth!.user.id) }))
  app.get('/api/v1/dashboards/:dashboardId/profiles', async (request) => ({ profiles: await dashboard.listProfiles(request.auth!.user.id, (request.params as { dashboardId: string }).dashboardId) }))
  app.patch('/api/v1/profiles/:profileId', async (request, reply) => { const id = (request.params as { profileId: string }).profileId; const result = await dashboard.updateProfile(request.auth!.user.id, id, request.body as { layoutVersion?: number }); if (!result) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Profile not found', requestId: request.id } }); await recordAudit({ userId: request.auth!.user.id, action: 'update', resourceType: 'profile', resourceId: id }); return result })
  app.get('/api/v1/profiles/:profileId/widgets', async (request) => {
    const params = request.params as { profileId: string }
    return { widgets: await dashboard.listWidgets(request.auth!.user.id, params.profileId) }
  })
  app.post('/api/v1/profiles/:profileId/widgets', {
    schema: { body: widgetBody },
  }, async (request, reply) => {
    const params = request.params as { profileId: string }
    const body = request.body as { widgetType: string; configuration?: unknown; layout?: unknown }
    if (!isWidgetTypeAllowed(body.widgetType)) return reply.code(400).send({ error: { code: 'INVALID_WIDGET_TYPE', message: 'Unknown widget type', requestId: request.id } })
    const widget = await dashboard.createWidget(request.auth!.user.id, params.profileId, body)
    if (widget) await recordAudit({ userId: request.auth!.user.id, action: 'create', resourceType: 'widget', resourceId: widget.id })
    return reply.code(201).send(widget)
  })
  app.patch('/api/v1/widgets/:widgetId', async (request, reply) => { const id = (request.params as { widgetId: string }).widgetId; const result = await dashboard.updateWidget(request.auth!.user.id, id, request.body as { configuration?: unknown; layout?: unknown; isEnabled?: boolean }, request.headers['if-unmodified-since']); if (!result) return reply.code(409).send({ error: { code: 'CONFLICT', message: 'Widget was modified or not found', requestId: request.id } }); await recordAudit({ userId: request.auth!.user.id, action: 'update', resourceType: 'widget', resourceId: id }); return result })
  app.delete('/api/v1/widgets/:widgetId', async (request, reply) => {
    const params = request.params as { widgetId: string }
    if (!await dashboard.deleteWidget(request.auth!.user.id, params.widgetId)) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Widget not found', requestId: request.id } })
    await recordAudit({ userId: request.auth!.user.id, action: 'delete', resourceType: 'widget', resourceId: params.widgetId })
    return { ok: true }
  })
  app.get('/api/v1/profiles/:profileId/bookmarks', async (request) => {
    const params = request.params as { profileId: string }
    return { bookmarks: await dashboard.listBookmarks(request.auth!.user.id, params.profileId) }
  })
  app.post('/api/v1/profiles/:profileId/bookmarks', {
    schema: { body: bookmarkBody },
  }, async (request, reply) => {
    const params = request.params as { profileId: string }
    const body = request.body as { name: string; url: string; icon?: string; category?: string }
    if (!['http:', 'https:'].includes(new URL(body.url).protocol) || new URL(body.url).username || new URL(body.url).password) return reply.code(400).send({ error: { code: 'INVALID_URL', message: 'Only public HTTP and HTTPS URLs are allowed', requestId: request.id } })
    const bookmark = await dashboard.createBookmark(request.auth!.user.id, params.profileId, body)
    if (bookmark) await recordAudit({ userId: request.auth!.user.id, action: 'create', resourceType: 'bookmark', resourceId: bookmark.id })
    return reply.code(201).send(bookmark)
  })
  app.patch('/api/v1/bookmarks/:bookmarkId', { schema: { body: bookmarkPatchBody } }, async (request, reply) => { const id = (request.params as { bookmarkId: string }).bookmarkId; const patch = request.body as { name?: string; url?: string; icon?: string; category?: string; sortOrder?: number }; if (patch.url) { const parsed = new URL(patch.url); if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return reply.code(400).send({ error: { code: 'INVALID_URL', message: 'Only public HTTP and HTTPS URLs are allowed', requestId: request.id } }) } const result = await dashboard.updateBookmark(request.auth!.user.id, id, patch); if (!result) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Bookmark not found', requestId: request.id } }); await recordAudit({ userId: request.auth!.user.id, action: 'update', resourceType: 'bookmark', resourceId: id }); return result })
  app.delete('/api/v1/bookmarks/:bookmarkId', async (request, reply) => { const id = (request.params as { bookmarkId: string }).bookmarkId; if (!await dashboard.deleteBookmark(request.auth!.user.id, id)) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Bookmark not found', requestId: request.id } }); await recordAudit({ userId: request.auth!.user.id, action: 'delete', resourceType: 'bookmark', resourceId: id }); return { ok: true } })

  app.get('/api/v1/events', async (request, reply) => {
    if (!request.auth) return reply.code(401).send({ error: 'Authentication required' })
    incrementMetric('homedash_sse_connections_total')
    reply.hijack()
    const response = reply.raw
    response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' })
    const send = (event: ReturnType<typeof heartbeatEvent>) => response.write(`id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
    const lastEventId = request.headers['last-event-id']
    for (const event of replayAfter(typeof lastEventId === 'string' ? lastEventId : undefined)) send(event)
    send(heartbeatEvent())
    const unsubscribe = subscribeEvents(send)
    const heartbeat = setInterval(() => send(heartbeatEvent()), 25_000)
    request.raw.on('close', () => { clearInterval(heartbeat); unsubscribe(); incrementMetric('homedash_sse_disconnects_total') })
  })

  app.get('/api/v1/dashboard', async (_request, reply) => {
    try { return await snapshotService.getSnapshot() } catch (error) {
      app.log.error(error)
      return reply.code(502).send({ error: 'Dashboard sources unavailable' })
    }
  })
  app.get('/api/v1/performance', async () => ({
    metrics: [
      { key: 'cpu', label: 'CPU', value: null, unit: '%', state: 'not_configured' },
      { key: 'gpu', label: 'GPU', value: null, unit: '%', state: 'not_configured' },
      { key: 'ram', label: 'RAM', value: null, unit: '%', state: 'not_configured' },
    ],
    generatedAt: new Date().toISOString(),
    sourceState: 'not_configured',
  }))
  app.get('/api/v1/services', async () => {
    const services = await listServices()
    const results = await checkServices(services.filter((service) => service.healthcheckUrl).map((service) => ({ id: service.id, url: service.healthcheckUrl! })))
    const health = new Map(results.map((result) => [result.id, result]))
    return { services: services.map((service) => ({ ...service, status: health.get(service.id)?.status ?? 'unknown' })), sourceState: 'ready' }
  })
  app.post('/api/v1/services', { schema: { body: serviceBody } }, async (request, reply) => {
    if (!request.auth?.user.isAdmin) return reply.code(403).send({ error: 'Admin access required' })
    return reply.code(201).send(await createService(request.body as { name: string; url: string; description?: string; host?: string; healthcheckUrl?: string; isEnabled?: boolean; sortOrder?: number }))
  })
  app.get('/api/v1/admin/services', async (request, reply) => request.auth?.user.isAdmin ? { services: await listAllServices() } : reply.code(403).send({ error: 'Admin access required' }))
  app.patch('/api/v1/services/:serviceId', { schema: { body: servicePatchBody } }, async (request, reply) => {
    if (!request.auth?.user.isAdmin) return reply.code(403).send({ error: 'Admin access required' })
    const result = await updateService((request.params as { serviceId: string }).serviceId, request.body as Record<string, unknown>)
    return result ?? reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Service not found', requestId: request.id } })
  })
  app.delete('/api/v1/services/:serviceId', async (request, reply) => {
    if (!request.auth?.user.isAdmin) return reply.code(403).send({ error: 'Admin access required' })
    if (!await deleteService((request.params as { serviceId: string }).serviceId)) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Service not found', requestId: request.id } })
    return { ok: true }
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
