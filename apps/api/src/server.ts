import { buildApp } from './app.js'
import { closeDatabase } from './db.js'
import { migrate } from './infrastructure/db/migrate.js'
import { config } from './config.js'
import { ensureBootstrapUser } from './auth.js'
import { cleanupExpiredSessions } from './infrastructure/observability.js'

const app = await buildApp()
let cleanupTimer: NodeJS.Timeout | undefined
let shuttingDown = false

const shutdown = async (signal: string): Promise<void> => {
  if (shuttingDown) return
  shuttingDown = true
  app.log.info({ signal }, 'Shutting down gracefully')
  if (cleanupTimer) clearInterval(cleanupTimer)
  try {
    await app.close()
  } finally {
    await closeDatabase()
  }
}

process.once('SIGTERM', () => { shutdown('SIGTERM').catch((error: unknown) => { app.log.error(error); process.exitCode = 1 }) })
process.once('SIGINT', () => { shutdown('SIGINT').catch((error: unknown) => { app.log.error(error); process.exitCode = 1 }) })

try {
  await migrate()
  await ensureBootstrapUser()
  await cleanupExpiredSessions()
  cleanupTimer = setInterval(() => { cleanupExpiredSessions().catch((cleanupError: unknown) => app.log.error(cleanupError)) }, 60 * 60 * 1000)
  cleanupTimer.unref()
  await app.listen({ host: config.host, port: config.port })
} catch (error) {
  app.log.error(error)
  await shutdown('startup failure')
  process.exitCode = 1
}
