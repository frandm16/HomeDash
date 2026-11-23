import { existsSync } from 'node:fs'

if (typeof process.loadEnvFile === 'function') {
  try {
    if (existsSync('.env')) {
      process.loadEnvFile('.env')
    } else if (existsSync('apps/api/.env')) {
      process.loadEnvFile('apps/api/.env')
    }
  } catch {
    // Ignore missing or unreadable env files
  }
}

const asPort = (value: string | undefined): number => {
  const port = Number(value ?? 3000)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535')
  return port
}

const asPositiveNumber = (name: string, value: string | undefined, fallback: number): number => {
  const parsed = Number(value ?? fallback)
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${name} must be a positive number`)
  return parsed
}

const nodeEnv = process.env.NODE_ENV ?? 'development'
const isProduction = nodeEnv === 'production'
const databaseUrl = process.env.DATABASE_URL ?? (isProduction ? '' : 'postgres://homedash:change-me@localhost:5432/homedash')
const corsOrigin = process.env.CORS_ORIGIN ?? (isProduction ? '' : 'http://localhost:5173')
const allowedEnvironments = new Set(['development', 'test', 'production'])
if (!allowedEnvironments.has(nodeEnv)) throw new Error('NODE_ENV must be development, test, or production')

if (!databaseUrl) throw new Error('DATABASE_URL is required in production')
if (!corsOrigin) throw new Error('CORS_ORIGIN is required in production')
if (isProduction && databaseUrl.includes('change-me')) throw new Error('DATABASE_URL must not use a placeholder in production')

export const config = {
  nodeEnv,
  isProduction,
  host: process.env.HOST ?? '127.0.0.1',
  port: asPort(process.env.PORT),
  corsOrigin,
  databaseUrl,
  sessionTtlDays: asPositiveNumber('SESSION_TTL_DAYS', process.env.SESSION_TTL_DAYS, 30),
  notificationCenterTimeoutMs: asPositiveNumber('NOTIFICATION_CENTER_TIMEOUT_MS', process.env.NOTIFICATION_CENTER_TIMEOUT_MS, 5000),
  logLevel: process.env.LOG_LEVEL ?? 'info',
}
