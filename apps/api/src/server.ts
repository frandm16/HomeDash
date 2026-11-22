import Fastify from 'fastify'
import cors from '@fastify/cors'
import { config } from './config.js'
import { createDevelopmentSources, createSnapshotService } from './snapshot.js'

const app = Fastify({ logger: true })
const snapshotService = createSnapshotService(createDevelopmentSources())

await app.register(cors, { origin: config.corsOrigin })

app.get('/health', async () => ({ status: 'ok' }))

app.get('/api/v1/dashboard', async (_request, reply) => {
  try {
    return await snapshotService.getSnapshot()
  } catch (error) {
    app.log.error(error)
    return reply.code(502).send({ error: 'Dashboard sources unavailable' })
  }
})

app.get('/api/v1/services', async () => {
  const snapshot = await snapshotService.getSnapshot()
  return { services: snapshot.services }
})

app.get('/api/v1/notifications', async (_request, reply) => {
  try {
    const snapshot = await snapshotService.getSnapshot()
    return {
      notifications: snapshot.notifications,
      unreadCount: snapshot.unreadNotifications,
    }
  } catch (error) {
    app.log.error(error)
    return reply.code(502).send({ error: 'Notification source unavailable' })
  }
})

try {
  await app.listen({ host: config.host, port: config.port })
} catch (error) {
  app.log.error(error)
  process.exit(1)
}
