import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import { config } from './config.js'
import { createDevelopmentSources, createSnapshotService } from './snapshot.js'
import { authenticate, clearSessionCookie, createSession, getSession, requireAuth, revokeSession, SESSION_COOKIE, setSessionCookie, verifyCsrf } from './auth.js'

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true, bodyLimit: 16 * 1024 })
  await app.register(cookie)
  await app.register(cors, { origin: config.corsOrigin, credentials: true })
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' })
  const snapshotService = createSnapshotService(createDevelopmentSources())

  app.get('/health', async () => ({ status: 'ok' }))

  app.post('/api/v1/auth/login', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request, reply) => {
    const body = request.body as { username?: string; password?: string } | undefined
    if (!body?.username || !body.password || body.username.length > 120 || body.password.length > 256) {
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

  app.addHook('preHandler', async (request, reply) => {
    if (request.url === '/health' || request.url.startsWith('/api/v1/auth/')) return
    await requireAuth(request, reply)
  })

  app.get('/api/v1/dashboard', async (_request, reply) => {
    try { return await snapshotService.getSnapshot() } catch (error) {
      app.log.error(error)
      return reply.code(502).send({ error: 'Dashboard sources unavailable' })
    }
  })
  app.get('/api/v1/services', async () => ({ services: (await snapshotService.getSnapshot()).services }))
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
