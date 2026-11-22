import { buildApp } from './app.js'
import { closeDatabase } from './db.js'
import { migrate } from './infrastructure/db/migrate.js'
import { config } from './config.js'
import { ensureBootstrapUser } from './auth.js'
import { cleanupExpiredSessions } from './infrastructure/observability.js'

const app = await buildApp()
try {
  await migrate()
  await ensureBootstrapUser()
  await cleanupExpiredSessions()
  const cleanupTimer = setInterval(() => { cleanupExpiredSessions().catch((cleanupError: unknown) => app.log.error(cleanupError)) }, 60 * 60 * 1000)
  cleanupTimer.unref()
  await app.listen({ host: config.host, port: config.port })
} catch (error) {
  app.log.error(error)
  await closeDatabase()
  process.exit(1)
}
