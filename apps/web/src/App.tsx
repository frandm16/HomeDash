import './App.css'

type ServiceStatus = 'online' | 'degraded' | 'offline'

type Service = {
  name: string
  description: string
  url: string
  status: ServiceStatus
  host: string
}

const services: Service[] = [
  {
    name: 'Notification Center',
    description: 'Central notification inbox',
    url: 'https://notifications.frandm.dev',
    status: 'online',
    host: '192.168.1.52:7778',
  },
  {
    name: 'Proxmox',
    description: 'Virtualization node management',
    url: 'https://proxmox.frandm.dev',
    status: 'online',
    host: '192.168.1.50:8006',
  },
  {
    name: 'Dokploy',
    description: 'Application deployment platform',
    url: 'https://dokploy.frandm.dev',
    status: 'degraded',
    host: '192.168.1.52:3000',
  },
  {
    name: 'Pi-hole',
    description: 'Network-wide DNS filtering',
    url: 'https://pihole.frandm.dev',
    status: 'online',
    host: '192.168.1.51:8080',
  },
]

const notifications = [
  {
    source: 'Proxmox',
    title: 'Backup completed successfully',
    detail: 'VM 200 · dokploy-vm',
    time: '12 min ago',
    level: 'success',
  },
  {
    source: 'System',
    title: 'Disk usage is above 80%',
    detail: 'dokploy-vm · /var/lib/docker',
    time: '34 min ago',
    level: 'warning',
  },
  {
    source: 'StudyZen',
    title: 'Exam reminder',
    detail: 'Artificial Intelligence · tomorrow',
    time: '1 h ago',
    level: 'info',
  },
]

function StatusDot({ status }: { status: ServiceStatus }) {
  return <span className={`status-dot ${status}`} aria-label={status} />
}

function App() {
  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="HomeDash home">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>HomeDash</span>
        </a>

        <div className="topbar-actions">
          <span className="connection-state">
            <span className="pulse-dot" aria-hidden="true" />
            All systems nominal
          </span>
          <button className="icon-button" type="button" aria-label="Toggle theme">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3v2m0 14v2M5.64 5.64l1.42 1.42m9.9 9.9 1.4 1.4M3 12h2m14 0h2M5.64 18.36l1.42-1.4m9.9-9.9 1.4-1.42M16.5 12a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
            </svg>
          </button>
          <button className="avatar" type="button" aria-label="Open account menu">FD</button>
        </div>
      </header>

      <section className="welcome-row" aria-labelledby="welcome-title">
        <div>
          <p className="eyebrow">SATURDAY, NOVEMBER 22, 2026</p>
          <h1 id="welcome-title">Good morning, Fran.</h1>
          <p className="muted">Your homelab at a glance.</p>
        </div>
        <div className="clock-card">
          <span className="clock-time">09:42</span>
          <span className="clock-zone">CET · Málaga</span>
        </div>
      </section>

      <section className="summary-grid" aria-label="Homelab summary">
        <article className="summary-card accent-blue">
          <div className="card-heading"><span className="card-icon">↗</span><span>Services online</span></div>
          <strong>12 <small>/ 13</small></strong>
          <p className="positive">+1 since yesterday</p>
        </article>
        <article className="summary-card accent-purple">
          <div className="card-heading"><span className="card-icon">◈</span><span>Notifications</span></div>
          <strong>3 <small>unread</small></strong>
          <p className="muted">Last received 12 min ago</p>
        </article>
        <article className="summary-card accent-green">
          <div className="card-heading"><span className="card-icon">⌁</span><span>System health</span></div>
          <strong>98<small>%</small></strong>
          <p className="positive">Everything looks good</p>
        </article>
      </section>

      <section className="content-grid">
        <article className="panel services-panel">
          <div className="panel-header">
            <div><p className="eyebrow">QUICK ACCESS</p><h2>Services</h2></div>
            <button className="text-button" type="button">View all <span>→</span></button>
          </div>
          <div className="service-list">
            {services.map((service) => (
              <a className="service-row" href={service.url} key={service.name}>
                <span className="service-logo">{service.name.slice(0, 1)}</span>
                <span className="service-copy"><strong>{service.name}</strong><small>{service.description}</small></span>
                <span className="service-meta"><span><StatusDot status={service.status} />{service.status}</span><small>{service.host}</small></span>
                <span className="arrow" aria-hidden="true">↗</span>
              </a>
            ))}
          </div>
        </article>

        <article className="panel notifications-panel">
          <div className="panel-header">
            <div className="title-with-badge"><div><p className="eyebrow">INBOX</p><h2>Notifications</h2></div><span className="count-badge">3</span></div>
            <button className="icon-button subtle" type="button" aria-label="Notification options">•••</button>
          </div>
          <div className="notification-list">
            {notifications.map((notification) => (
              <button className="notification-row" type="button" key={notification.title}>
                <span className={`notification-indicator ${notification.level}`} />
                <span className="notification-copy"><strong>{notification.title}</strong><small>{notification.source} · {notification.detail}</small></span>
                <time>{notification.time}</time>
              </button>
            ))}
          </div>
          <button className="outline-button" type="button">Open Notification Center <span>↗</span></button>
        </article>
      </section>

      <footer className="footer"><span>HomeDash <span className="footer-separator">/</span> Homelab overview</span><span>API connection <span className="pulse-dot" aria-hidden="true" /></span></footer>
    </main>
  )
}

export default App
