import type { ReactNode } from 'react'
import type { Bookmark, DashboardNotification, Service, ServiceStatus, Widget } from './api'

export type WidgetData = { services: Service[]; notifications: DashboardNotification[]; unreadNotifications: number; bookmarks: Bookmark[] }
export type WidgetRenderProps = { data: WidgetData; state: 'loading' | 'ready' | 'empty' | 'offline' | 'stale' | 'error'; message?: string }
export type WidgetDefinition = { type: string; version: number; defaultSize: { w: number; h: number }; configuration: Record<string, unknown>; render: (props: WidgetRenderProps) => ReactNode }

function State({ state, message }: Pick<WidgetRenderProps, 'state' | 'message'>) {
  if (state === 'loading') return <p className="widget-state">Cargando…</p>
  if (state === 'offline') return <p className="widget-state">Sin conexión{message ? ` · ${message}` : ''}</p>
  if (state === 'error') return <p className="widget-state">No se pudo cargar este widget.</p>
  if (state === 'stale') return <p className="widget-state">Datos sin actualizar · mostrando la última captura</p>
  return null
}

function StatusDot({ status }: { status: ServiceStatus }) { return <span className={`status-dot ${status}`} aria-label={status} /> }
function ServicesWidget({ data, state, message }: WidgetRenderProps) {
  return <article className="panel widget-panel services-panel"><div className="panel-header"><div><p className="eyebrow">QUICK ACCESS</p><h2>Services</h2></div></div><State state={state} message={message} />{state !== 'loading' && <div className="service-list">{data.services.map((service) => <a className="service-row" href={service.url} key={service.name}><span className="service-logo">{service.name.slice(0, 1)}</span><span className="service-copy"><strong>{service.name}</strong><small>{service.description}</small></span><span className="service-meta"><span><StatusDot status={service.status} />{service.status}</span><small>{service.host}</small></span><span className="arrow">↗</span></a>)}</div>}</article>
}
function NotificationsWidget({ data, state, message }: WidgetRenderProps) {
  return <article className="panel widget-panel notifications-panel"><div className="panel-header"><div className="title-with-badge"><div><p className="eyebrow">INBOX</p><h2>Notifications</h2></div><span className="count-badge">{data.unreadNotifications}</span></div></div><State state={state} message={message} />{state !== 'loading' && <div className="notification-list">{data.notifications.map((notification) => <div className="notification-row" key={notification.id}><span className={`notification-indicator ${notification.level.toLowerCase()}`} /><span className="notification-copy"><strong>{notification.title}</strong><small>{notification.source} · {notification.body}</small></span><time>{new Date(notification.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</time></div>)}</div>}</article>
}
function BookmarksWidget({ data, state, message }: WidgetRenderProps) {
  return <article className="panel widget-panel bookmarks-panel"><div className="panel-header"><div><p className="eyebrow">QUICK LINKS</p><h2>Bookmarks</h2></div></div><State state={state} message={message} />{state !== 'loading' && (data.bookmarks.length ? <div className="bookmark-list">{data.bookmarks.map((bookmark) => <a href={bookmark.url} className="bookmark" key={bookmark.id}><span>{bookmark.icon ?? bookmark.name.slice(0, 1)}</span><strong>{bookmark.name}</strong></a>)}</div> : <p className="widget-state">No hay marcadores configurados.</p>)}</article>
}

export const widgetRegistry: Record<string, WidgetDefinition> = {
  'service-status': { type: 'service-status', version: 1, defaultSize: { w: 4, h: 3 }, configuration: {}, render: ServicesWidget },
  notifications: { type: 'notifications', version: 1, defaultSize: { w: 4, h: 4 }, configuration: {}, render: NotificationsWidget },
  bookmarks: { type: 'bookmarks', version: 1, defaultSize: { w: 4, h: 2 }, configuration: {}, render: BookmarksWidget },
}
export const defaultWidgets: Widget[] = Object.keys(widgetRegistry).map((widgetType) => ({ id: `default-${widgetType}`, widgetType, widgetVersion: 1, configuration: {}, layout: widgetRegistry[widgetType].defaultSize, isEnabled: true }))
