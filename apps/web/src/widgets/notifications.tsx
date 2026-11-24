import type { WidgetRenderProps } from './types'
import { State } from './shared'

function formatRelativeTime(dateString: string): string {
  try {
    const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
    if (diff < 60) return 'Just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

export function NotificationsWidget({ data, state, message, configuration }: WidgetRenderProps) {
  const notificationStyle = String(configuration?.notificationStyle ?? 'cards')
  const maxItems = Number(configuration?.maxItems ?? 6)
  const items = data.notifications.slice(0, maxItems)

  return (
    <section className={`widget-card notifications-widget style-${notificationStyle}`}>
      <State state={state} message={message}/>

      {state === 'ready' && !data.notifications.length && (
        <div className="notifications-empty-state">
          <span className="empty-bell-icon">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/>
              <path d="M10 21h4"/>
            </svg>
          </span>
          <p>You&apos;re all caught up</p>
          <small>No unread notifications right now</small>
        </div>
      )}

      {state === 'ready' && data.notifications.length > 0 && (
        <>
          {notificationStyle === 'badge-only' && (
            <div className="notifications-badge-hero">
              <div className="badge-glow-circle">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/>
                  <path d="M10 21h4"/>
                </svg>
                {data.unreadNotifications > 0 && (
                  <span className="unread-dot-pulse"/>
                )}
              </div>
              <div className="badge-hero-count">{data.unreadNotifications}</div>
              <div className="badge-hero-label">Unread notifications</div>
            </div>
          )}

          {notificationStyle === 'compact-ticker' && (
            <div className="notifications-ticker-view">
              <div className="ticker-top">
                <span className="ticker-pill">{data.unreadNotifications} unread</span>
                <span className="ticker-time">{items[0] ? formatRelativeTime(items[0].createdAt) : ''}</span>
              </div>
              {items[0] && (
                <div className={`ticker-headline level-${items[0].level.toLowerCase()}`}>
                  <span className="ticker-indicator"/>
                  <strong>{items[0].title}</strong>
                  <p>{items[0].body}</p>
                </div>
              )}
            </div>
          )}

          {notificationStyle === 'timeline' && (
            <div className="notifications-timeline">
              <div className="timeline-header">
                <span className="count-chip">{data.unreadNotifications} unread</span>
              </div>
              <div className="timeline-stream">
                {items.map(notification => (
                  <div className={`timeline-entry level-${notification.level.toLowerCase()}`} key={notification.id}>
                    <div className="timeline-bullet"/>
                    <div className="timeline-body">
                      <div className="timeline-meta">
                        <span className="timeline-source">{notification.source}</span>
                        <time>{formatRelativeTime(notification.createdAt)}</time>
                      </div>
                      <strong className="timeline-title">{notification.title}</strong>
                      <p className="timeline-desc">{notification.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {notificationStyle === 'cards' && (
            <div className="notifications-cards-view">
              <div className="notifications-head-row">
                <span className="count-chip">{data.unreadNotifications} unread</span>
              </div>
              <div className="notification-cards-list">
                {items.map(notification => (
                  <article className={`glass-notification-card level-${notification.level.toLowerCase()}`} key={notification.id}>
                    <div className="notif-card-header">
                      <span className={`notif-status-badge level-${notification.level.toLowerCase()}`}>
                        {notification.level}
                      </span>
                      <time>{formatRelativeTime(notification.createdAt)}</time>
                    </div>
                    <strong className="notif-card-title">{notification.title}</strong>
                    <p className="notif-card-body">{notification.body}</p>
                    <div className="notif-card-footer">
                      <small>{notification.source}</small>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}
