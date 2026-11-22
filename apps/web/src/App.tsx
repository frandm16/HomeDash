import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { fetchDashboard, getSession, login, logout, type AuthUser, type DashboardSnapshot, type ServiceStatus } from './api'
import './App.css'

function StatusDot({ status }: { status: ServiceStatus }) { return <span className={`status-dot ${status}`} aria-label={status} /> }

function LoginScreen({ onAuthenticated }: { onAuthenticated: (user: AuthUser) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setLoading(true)
    try { const result = await login(username, password); onAuthenticated(result.user) } catch { setError('Usuario o contraseña incorrectos') } finally { setLoading(false) }
  }
  return <main className="auth-shell"><div className="auth-card"><div className="auth-brand"><span className="brand-mark"><span /><span /><span /></span><strong>HomeDash</strong></div><p className="eyebrow">ACCESO PRIVADO</p><h1>Bienvenido de nuevo</h1><p className="muted">Inicia sesión para acceder a tu homelab.</p><form onSubmit={submit} className="auth-form"><label>Usuario<input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required /></label><label>Contraseña<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{error && <p className="auth-error" role="alert">{error}</p>}<button className="primary-button" disabled={loading}>{loading ? 'Comprobando…' : 'Iniciar sesión'}</button></form></div></main>
}

function Dashboard({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null)
  const [apiOnline, setApiOnline] = useState(false)
  useEffect(() => { const controller = new AbortController(); fetchDashboard(controller.signal).then((data) => { setSnapshot(data); setApiOnline(true) }).catch(() => setApiOnline(false)); return () => controller.abort() }, [])
  if (!snapshot) return <main className="auth-shell"><div className="auth-card"><p className="muted">Cargando dashboard…</p></div></main>
  const onlineServices = snapshot.services.filter((service) => service.status === 'online').length
  return <main className="dashboard-shell"><header className="topbar"><a className="brand" href="/" aria-label="HomeDash home"><span className="brand-mark"><span /><span /><span /></span><span>HomeDash</span></a><div className="topbar-actions"><span className="connection-state"><span className={`pulse-dot ${apiOnline ? '' : 'offline'}`} />{apiOnline ? 'API connected' : 'API unavailable'}</span><span className="user-name">{user.username}</span><button className="text-button" type="button" onClick={onLogout}>Cerrar sesión</button></div></header><section className="welcome-row" aria-labelledby="welcome-title"><div><p className="eyebrow">HOMELAB OVERVIEW</p><h1 id="welcome-title">Bienvenido, {user.username}.</h1><p className="muted">Tu homelab de un vistazo.</p></div></section><section className="summary-grid" aria-label="Homelab summary"><article className="summary-card accent-blue"><div className="card-heading"><span className="card-icon">↗</span><span>Services online</span></div><strong>{onlineServices} <small>/ {snapshot.services.length}</small></strong><p className="positive">Live from HomeDash API</p></article><article className="summary-card accent-purple"><div className="card-heading"><span className="card-icon">◈</span><span>Notifications</span></div><strong>{snapshot.unreadNotifications} <small>unread</small></strong><p className="muted">Notification Center</p></article><article className="summary-card accent-green"><div className="card-heading"><span className="card-icon">⌁</span><span>System health</span></div><strong>100<small>%</small></strong><p className="positive">API responding</p></article></section><section className="content-grid"><article className="panel services-panel"><div className="panel-header"><div><p className="eyebrow">QUICK ACCESS</p><h2>Services</h2></div></div><div className="service-list">{snapshot.services.map((service) => <a className="service-row" href={service.url} key={service.name}><span className="service-logo">{service.name.slice(0, 1)}</span><span className="service-copy"><strong>{service.name}</strong><small>{service.description}</small></span><span className="service-meta"><span><StatusDot status={service.status} />{service.status}</span><small>{service.host}</small></span><span className="arrow">↗</span></a>)}</div></article><article className="panel notifications-panel"><div className="panel-header"><div className="title-with-badge"><div><p className="eyebrow">INBOX</p><h2>Notifications</h2></div><span className="count-badge">{snapshot.unreadNotifications}</span></div></div><div className="notification-list">{snapshot.notifications.map((notification) => <div className="notification-row" key={notification.id}><span className={`notification-indicator ${notification.level.toLowerCase()}`} /><span className="notification-copy"><strong>{notification.title}</strong><small>{notification.source} · {notification.body}</small></span><time>{new Date(notification.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</time></div>)}</div></article></section><footer className="footer"><span>HomeDash <span className="footer-separator">/</span> Homelab overview</span><span>Sesión persistente <span className="pulse-dot" /></span></footer></main>
}

function App() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [checking, setChecking] = useState(true)
  useEffect(() => { getSession().then((result) => setUser(result.user)).catch(() => setUser(null)).finally(() => setChecking(false)) }, [])
  if (checking) return <main className="auth-shell"><div className="auth-card"><p className="muted">Comprobando sesión…</p></div></main>
  if (!user) return <LoginScreen onAuthenticated={setUser} />
  return <Dashboard user={user} onLogout={async () => { await logout().catch(() => undefined); setUser(null) }} />
}
export default App
