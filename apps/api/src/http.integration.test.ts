import assert from 'node:assert/strict'
import test from 'node:test'
import type { AppDependencies } from './app.js'
import { buildApp } from './app.js'
import { SESSION_COOKIE } from './auth.js'

type Session = { user: { id: string; username: string }; token: string; expiresAt: Date; csrfToken: string }

const user = { id: '11111111-1111-4111-8111-111111111111', username: 'alice' }
const session: Session = { user, token: 'session-token', expiresAt: new Date('2030-01-01T00:00:00.000Z'), csrfToken: 'csrf-token' }

function dependencies(overrides: Partial<AppDependencies> = {}): AppDependencies {
  const auth = {
    authenticate: async () => user,
    createSession: async () => session,
    getSession: async (token?: string) => token === session.token ? session : null,
    revokeAllSessions: async () => undefined,
    revokeSession: async () => undefined,
    requireAuth: async (request: any, reply: any) => {
      const current = tokenFrom(request) === session.token ? session : null
      if (!current) await reply.code(401).send({ error: 'Authentication required' })
      else request.auth = current
      return current
    },
  }
  const dashboard = {
    listDashboards: async (userId: string) => userId === user.id ? [{ id: 'dash-1' }] : [],
    createDashboard: async (_userId: string, input: { name: string }) => ({ id: 'dash-2', ...input }),
    updateDashboard: async () => undefined,
    deleteDashboard: async () => false,
    listProfiles: async () => [], updateProfile: async () => undefined,
    listWidgets: async () => [], createWidget: async () => undefined, updateWidget: async () => undefined, deleteWidget: async () => false,
    listBookmarks: async () => [], createBookmark: async () => undefined, updateBookmark: async () => undefined, deleteBookmark: async () => false,
  } as unknown as AppDependencies['dashboard']
  return { auth, dashboard, recordAudit: async () => undefined, ...overrides }
}

function tokenFrom(request: any): string | undefined {
  const header = request.headers.cookie as string | undefined
  return header?.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))?.[1]
}

async function withApp(run: (app: Awaited<ReturnType<typeof buildApp>>) => Promise<void>, deps = dependencies()) {
  const app = await buildApp(deps)
  try { await run(app) } finally { await app.close() }
}

test('public health and auth session endpoints work without PostgreSQL', async () => {
  await withApp(async (app) => {
    const health = await app.inject({ method: 'GET', url: '/health/live' })
    assert.equal(health.statusCode, 200)
    const unauthenticated = await app.inject({ method: 'GET', url: '/api/v1/auth/session' })
    assert.equal(unauthenticated.statusCode, 401)
  })
})

test('login returns CSRF token and secure session cookie', async () => {
  await withApp(async (app) => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { username: 'alice', password: 'secret' } })
    assert.equal(response.statusCode, 200)
    assert.equal(response.json().csrfToken, session.csrfToken)
    assert.match(response.headers['set-cookie'] as string, new RegExp(`${SESSION_COOKIE}=${session.token}`))
  })
})

test('protected routes require authentication and mutating routes require CSRF', async () => {
  await withApp(async (app) => {
    const protectedResponse = await app.inject({ method: 'GET', url: '/api/v1/dashboards' })
    assert.equal(protectedResponse.statusCode, 401)
    const cookie = `${SESSION_COOKIE}=${session.token}`
    const withoutCsrf = await app.inject({ method: 'POST', url: '/api/v1/dashboards', headers: { cookie }, payload: { name: 'Office' } })
    assert.equal(withoutCsrf.statusCode, 403)
    const withCsrf = await app.inject({ method: 'POST', url: '/api/v1/dashboards', headers: { cookie, 'x-csrf-token': session.csrfToken }, payload: { name: 'Office' } })
    assert.equal(withCsrf.statusCode, 201)
  })
})

test('Fastify validation rejects malformed dashboard and bookmark payloads', async () => {
  await withApp(async (app) => {
    const headers = { cookie: `${SESSION_COOKIE}=${session.token}`, 'x-csrf-token': session.csrfToken }
    const dashboardResponse = await app.inject({ method: 'POST', url: '/api/v1/dashboards', headers, payload: { name: '' } })
    assert.equal(dashboardResponse.statusCode, 400)
    assert.equal(dashboardResponse.json().error.code, 'VALIDATION_ERROR')
    const bookmarkResponse = await app.inject({ method: 'POST', url: '/api/v1/profiles/profile-1/bookmarks', headers, payload: { name: 'x', url: 'not-a-url' } })
    assert.equal(bookmarkResponse.statusCode, 400)
  })
})

test('ownership-scoped repository results are used for authenticated users', async () => {
  let requestedUserId = ''
  const deps = dependencies({ dashboard: { ...dependencies().dashboard, listDashboards: async (userId: string) => { requestedUserId = userId; return [{ id: 'owned' }] } } as AppDependencies['dashboard'] })
  await withApp(async (app) => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/dashboards', headers: { cookie: `${SESSION_COOKIE}=${session.token}` } })
    assert.equal(response.statusCode, 200)
    assert.equal(requestedUserId, user.id)
    assert.deepEqual(response.json().dashboards, [{ id: 'owned' }])
  }, deps)
})
