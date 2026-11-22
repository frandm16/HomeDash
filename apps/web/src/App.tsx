import { useEffect, useState } from 'react'
import { fetchDashboard, type DashboardSnapshot, type ServiceStatus } from './api'
import './App.css'

const fallbackSnapshot: DashboardSnapshot = {
  services: [
    { name: 'Notification Center', description: 'Central notification inbox', url: 'https://notifications.frandm.dev', status: 'online', host: '192.168.1.52:7778' },
    { name: 'Proxmox', description: 'Virtualization node management', url: 'https://proxmox.frandm.dev', status: 'online', host: '192.168.1.50:8006' },
    { name: 'Dokploy', description: 'Application deployment platform', url: 'https://dokploy.frandm.dev', status: 'degraded', host: '192.168.1.52:3000' },
    { name: 'Pi-hole', description: 'Network-wide DNS filtering', url: 'https://pihole.frandm.dev', status: 'online', host: '192.168.1.51:8080' },
  ],
  notifications: [
    { id: 'fallback-1', source: 'Proxmox', title: 'Backup completed successfully', body: 'VM 200 · dokploy-vm', level: 'SUCCESS', read: false, createdAt: '2026-11-22T08:30:00.000Z' },
    { id: 'fallback-2', source: 'System', title: 'Disk usage is above 80%', body: 'dokploy-vm · /var/lib/docker', level: 'WARNING', read: false, createdAt: '2026-11-22T08:08:00.000Z' },
    { id: 'fallback-3', source: 'StudyZen', title: 'Exam reminder', body: 'Artificial Intelligence · tomorrow', level: 'INFO', read: false, createdAt: '2026-11-22T07:42:00.000Z' },
  ],
  unreadNotifications: 3,
  generatedAt: new Date().toISOString(),
}

function StatusDot({ status }: { status: ServiceStatus }) {
  return <span className={`status-dot ${status}`} aria-label={status} />
}

function App() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(fallbackSnapshot)
  const [apiOnline, setApiOnline] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetchDashboard(controller.signal)
      .then((data) => { setSnapshot(data); setApiOnline(true) })
      .catch(() => setApiOnline(false))
    return () => controller.abort()
  }, [])

  const onlineServices = snapshot.services.filter((service) => service.status === 'online').length

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="HomeDash home"><span className="brand-mark" aria-hidden="true"><span /><span /><span /></span><span>HomeDash</span></a>
        <div className="topbar-actions">
          <span className="connection-state"><span className={`pulse-dot ${apiOnline ? '' : 'offline'}`} aria-hidden="true" />{apiOnline ? 'API connected' : 'Using local preview'}</span>
          <button className="icon-button" type="button" aria-label="Toggle theme"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v2m0 14v2M5.64 5.64l1.42 1.42m9.9 9.9 1.4 1.4M3 12h2m14 0h2M5.64 18.36l1.42-1.4m9.9-9.9 1.4-1.42M16.5 12a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" /></svg></button>
          <button className="avatar" type="button" aria-label="Open account menu">FD</button>
        </div>
      </header>

      <section className="welcome-row" aria-labelledby="welcome-title"><div><p className="eyebrow">SATURDAY, NOVEMBER 22, 2026</p><h1 id="welcome-title">Good morning, Fran.</h1><p className="muted">Your homelab at a glance.</p></div><div className="clock-card"><span className="clock-time">09:42</span><span className="clock-zone">CET · Málaga</span></div></section>

      <section className="summary-grid" aria-label="Homelab summary">
        <article className="summary-card accent-blue"><div className="card-heading"><span className="card-icon">↗</span><span>Services online</span></div><strong>{onlineServices} <small>/ {snapshot.services.length}</small></strong><p className="positive">Live from HomeDash API</p></article>
        <article className="summary-card accent-purple"><div className="card-heading"><span className="card-icon">◈</span><span>Notifications</span></div><strong>{snapshot.unreadNotifications} <small>unread</small></strong><p className="muted">Notification Center preview</p></article>
        <article className="summary-card accent-green"><div className="card-heading"><span className="card-icon">⌁</span><span>System health</span></div><strong>{apiOnline ? '100' : '—'}<small>{apiOnline ? '%' : ''}</small></strong><p className={apiOnline ? 'positive' : 'muted'}>{apiOnline ? 'API responding' : 'API unavailable'}</p></article>
      </section>

      <section className="content-grid">
        <article className="panel services-panel"><div className="panel-header"><div><p className="eyebrow">QUICK ACCESS</p><h2>Services</h2></div><button className="text-button" type="button">View all <span>→</span></button></div><div className="service-list">{snapshot.services.map((service) => <a className="service-row" href={service.url} key={service.name}><span className="service-logo">{service.name.slice(0, 1)}</span><span className="service-copy"><strong>{service.name}</strong><small>{service.description}</small></span><span className="service-meta"><span><StatusDot status={service.status} />{service.status}</span><small>{service.host}</small></span><span className="arrow" aria-hidden="true">↗</span></a>)}</div></article>
        <article className="panel notifications-panel"><div className="panel-header"><div className="title-with-badge"><div><p className="eyebrow">INBOX</p><h2>Notifications</h2></div><span className="count-badge">{snapshot.unreadNotifications}</span></div><button className="icon-button subtle" type="button" aria-label="Notification options">•••</button></div><div className="notification-list">{snapshot.notifications.map((notification) => <button className="notification-row" type="button" key={notification.id}><span className={`notification-indicator ${notification.level.toLowerCase()}`} /><span className="notification-copy"><strong>{notification.title}</strong><small>{notification.source} · {notification.body}</small></span><time>{new Date(notification.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</time></button>)}</div><button className="outline-button" type="button">Open Notification Center <span>↗</span></button></article>
      </section>
      <footer className="footer"><span>HomeDash <span className="footer-separator">/</span> Homelab overview</span><span>API connection <span className={`pulse-dot ${apiOnline ? '' : 'offline'}`} aria-hidden="true" /></span></footer>
    </main>
  )
}

export default App
