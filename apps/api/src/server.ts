import Fastify from 'fastify'
import cors from '@fastify/cors'
import { config } from './config.js'
import { getSnapshot } from './snapshot.js'

const app = Fastify({ logger: true })

await app.register(cors, { origin: config.corsOrigin })

app.get('/health', async () => ({ status: 'ok' }))

app.get('/api/v1/dashboard', async () => getSnapshot())

app.get('/api/v1/services', async () => ({ services: getSnapshot().services }))

app.get('/api/v1/notifications', async () => {
  const snapshot = getSnapshot()
  return {
    notifications: snapshot.notifications,
    unreadCount: snapshot.unreadNotifications,
  }
})

try {
  await app.listen({ host: config.host, port: config.port })
} catch (error) {
  app.log.error(error)
  process.exit(1)
}
