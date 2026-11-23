import argon2 from 'argon2'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { pool } from './db.js'
import { config } from './config.js'

export const SESSION_COOKIE = 'homedash_session'
export const CSRF_COOKIE = 'homedash_csrf'
const sessionTtlMs = config.sessionTtlDays * 24 * 60 * 60 * 1000

type User = { id: string; username: string; isAdmin?: boolean }
type Session = { user: User; token: string; expiresAt: Date; lastSeenAt: Date; csrfToken: string; csrfTokenHash: string }
const sessionTouchIntervalMs = 15 * 60 * 1000

declare module 'fastify' {
  interface FastifyRequest { auth?: Session }
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')
const hashCsrfToken = (token: string) => createHash('sha256').update(token).digest('hex')

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id })
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password)
}

export async function ensureBootstrapUser(): Promise<void> {
  const username = process.env.BOOTSTRAP_USERNAME || (process.env.NODE_ENV === 'development' ? 'admin' : undefined)
  const password = process.env.BOOTSTRAP_PASSWORD || (process.env.NODE_ENV === 'development' ? 'change-me' : undefined)
  if (!username || !password) return
  const existing = await pool.query('SELECT id FROM users LIMIT 1')
  if (existing.rowCount === 0) {
    await pool.query('INSERT INTO users (username, password_hash) VALUES ($1, $2)', [username, await hashPassword(password)])
    console.log(`Created initial HomeDash user '${username}' from bootstrap configuration`)
  }
}

const dummyPasswordHash = '$argon2id$v=19$m=65536,t=3,p=4$ZHVtbXktc2FsdA$0t1L8xR0a9hYQ3Qj8f2D4w'

export async function authenticate(username: string, password: string): Promise<User | null> {
  const result = await pool.query<{ id: string; username: string; password_hash: string; is_active: boolean; is_admin: boolean }>(
    'SELECT id, username, password_hash, is_active, is_admin FROM users WHERE username = $1', [username],
  )
  const user = result.rows[0]
  const validPassword = await verifyPassword(user?.password_hash ?? dummyPasswordHash, password).catch(() => false)
  if (!user || !user.is_active || !validPassword) return null
  return { id: user.id, username: user.username, isAdmin: user.is_admin }
}

export async function createSession(user: User): Promise<Session> {
  const token = randomBytes(32).toString('hex')
  const csrfToken = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + sessionTtlMs)
  await pool.query('INSERT INTO sessions (token_hash, user_id, expires_at, csrf_token_hash) VALUES ($1, $2, $3, $4)', [hashToken(token), user.id, expiresAt, hashCsrfToken(csrfToken)])
  return { user, token, expiresAt, lastSeenAt: new Date(), csrfToken, csrfTokenHash: hashCsrfToken(csrfToken) }
}

export async function getSession(token: string | undefined): Promise<Session | null> {
  if (!token) return null
  const result = await pool.query<{ user_id: string; username: string; is_admin: boolean; expires_at: Date; last_seen_at: Date; csrf_token_hash: string }>(
    `SELECT users.id AS user_id, users.username, users.is_admin, sessions.expires_at, sessions.last_seen_at, sessions.csrf_token_hash FROM sessions JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = $1 AND sessions.revoked_at IS NULL AND sessions.expires_at > NOW() AND users.is_active = TRUE`, [hashToken(token)],
  )
  const row = result.rows[0]
  if (!row) return null
  if (Date.now() - row.last_seen_at.getTime() >= sessionTouchIntervalMs) {
    await pool.query('UPDATE sessions SET last_seen_at = NOW() WHERE token_hash = $1', [hashToken(token)])
  }
  return { user: { id: row.user_id, username: row.username, isAdmin: row.is_admin }, token, expiresAt: row.expires_at, lastSeenAt: row.last_seen_at, csrfToken: '', csrfTokenHash: row.csrf_token_hash }
}

export function verifyCsrf(request: FastifyRequest, session: Session): boolean {
  const provided = request.headers['x-csrf-token']
  if (typeof provided !== 'string' || !/^[a-f0-9]{64}$/.test(provided)) return false
  const providedHash = Buffer.from(hashCsrfToken(provided), 'hex')
  const expectedHash = Buffer.from(session.csrfTokenHash, 'hex')
  return providedHash.length === expectedHash.length && timingSafeEqual(providedHash, expectedHash)
}

export async function revokeSession(token: string | undefined): Promise<void> {
  if (token) await pool.query('UPDATE sessions SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL', [hashToken(token)])
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await pool.query('UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [userId])
}

export async function touchSession(session: Session): Promise<void> {
  if (Date.now() - session.lastSeenAt.getTime() < 15 * 60 * 1000) return
  await pool.query('UPDATE sessions SET last_seen_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL', [hashToken(session.token)])
}

export function setSessionCookie(reply: FastifyReply, session: Session): void {
  reply.setCookie(CSRF_COOKIE, session.csrfToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: session.expiresAt,
  })
  reply.setCookie(SESSION_COOKIE, session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: session.expiresAt,
  })
}

export function clearSessionCookie(reply: FastifyReply): void {
  const options = { secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' }
  reply.clearCookie(SESSION_COOKIE, { ...options, httpOnly: true })
  reply.clearCookie(CSRF_COOKIE, options)
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<Session | null> {
  const session = await getSession(request.cookies[SESSION_COOKIE])
  if (!session) {
    await reply.code(401).send({ error: 'Authentication required' })
    return null
  }
  request.auth = session
  return session
}
