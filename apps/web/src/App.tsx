import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { createBookmark, createWidget, deleteBookmark, deleteWidget, fetchBookmarks, fetchDashboard, fetchPerformance, fetchProfiles, fetchWidgetDefinitions, fetchWidgets, getSession, login, logout, openEvents, updateBookmark, updateWidget, type AuthUser, type Bookmark, type DashboardProfile, type DashboardSnapshot, type PerformanceSnapshot, type Widget, type WidgetDefinition } from './api'
import { widgetRegistry, type WidgetData } from './widgets'
import { moveWidget } from './grid'
import './App.css'

type ToastState = 'saved' | 'saving' | 'error'

function LoginScreen({ onAuthenticated }: { onAuthenticated: (user: AuthUser) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setLoading(true)
    try { const result = await login(username, password); onAuthenticated(result.user) }
    catch { setError('Usuario o contraseña incorrectos') }
    finally { setLoading(false) }
  }
  return <main className="login-page"><form onSubmit={submit} className="login-card"><div className="brand-lockup"><span className="brand-symbol">H</span><span>HOMEDASH<small>PRIVATE HOMELAB</small></span></div><p className="kicker">ACCESO PRIVADO</p><h1>Tu homelab,<br />en un solo lugar.</h1><p className="subtle">Inicia sesión para abrir tu dashboard.</p><label>Usuario<input autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} required /></label><label>Contraseña<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary" disabled={loading}>{loading ? 'Comprobando…' : 'Entrar al dashboard'}<span>↗</span></button></form></main>
}

function BookmarkDialog({ bookmark, profileId, onClose, onSaved }: { bookmark?: Bookmark; profileId: string; onClose: () => void; onSaved: (bookmark: Bookmark) => void }) {
  const [name, setName] = useState(bookmark?.name ?? '')
  const [url, setUrl] = useState(bookmark?.url ?? '')
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    try {
      const parsed = new URL(url)
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error()
      const result = bookmark ? await updateBookmark(bookmark.id, { name, url }) : await createBookmark(profileId, { name, url })
      onSaved(result); onClose()
    } catch { setError('Introduce un nombre y una URL http(s) válida.') }
  }
  return <div className="overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><form className="dialog" onSubmit={submit}><div className="dialog-heading"><div><p className="kicker">ACCESO RÁPIDO</p><h2>{bookmark ? 'Editar marcador' : 'Añadir marcador'}</h2></div><button type="button" className="close-button" onClick={onClose} aria-label="Cerrar">×</button></div><label>Nombre<input value={name} onChange={event => setName(event.target.value)} required /></label><label>URL<input type="url" value={url} onChange={event => setUrl(event.target.value)} required /></label>{error && <p className="form-error">{error}</p>}<div className="dialog-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancelar</button><button className="button button-primary">Guardar marcador</button></div></form></div>
}

function WidgetSettings({ widget, onClose, onSave }: { widget: Widget; onClose: () => void; onSave: (configuration: Record<string, unknown>) => void }) {
  const [provider, setProvider] = useState(String(widget.configuration.provider ?? 'google'))
  const [newTab, setNewTab] = useState(widget.configuration.openInNewTab !== false)
  return <div className="overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><section className="dialog"><div className="dialog-heading"><div><p className="kicker">AJUSTES DEL WIDGET</p><h2>Buscador</h2></div><button className="close-button" onClick={onClose} aria-label="Cerrar">×</button></div><label>Proveedor<select value={provider} onChange={event => setProvider(event.target.value)}><option value="google">Google</option><option value="duckduckgo">DuckDuckGo</option></select></label><label className="check-label"><input type="checkbox" checked={newTab} onChange={event => setNewTab(event.target.checked)} /> Abrir resultados en pestaña nueva</label><div className="dialog-actions"><button className="button button-quiet" onClick={onClose}>Cancelar</button><button className="button button-primary" onClick={() => onSave({ ...widget.configuration, provider, openInNewTab: newTab })}>Guardar ajustes</button></div></section></div>
}

function Dashboard({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null)
  const [performance, setPerformance] = useState<PerformanceSnapshot | null>(null)
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [widgets, setWidgets] = useState<Widget[]>([])
  const [definitions, setDefinitions] = useState<WidgetDefinition[]>([])
  const [profile, setProfile] = useState<DashboardProfile | null>(null)
  const [editing, setEditing] = useState(false)
  const [showCatalog, setShowCatalog] = useState(false)
  const [bookmarkDialog, setBookmarkDialog] = useState<{ bookmark?: Bookmark } | null>(null)
  const [settingsWidget, setSettingsWidget] = useState<Widget | null>(null)
  const [connection, setConnection] = useState<'loading' | 'online' | 'stale' | 'offline'>('loading')
  const [saveState, setSaveState] = useState<ToastState>('saved')
  const [clock, setClock] = useState(() => new Date())
  const saveTimer = useRef<number | undefined>(undefined)
  const data: WidgetData = { services: snapshot?.services ?? [], notifications: snapshot?.notifications ?? [], unreadNotifications: snapshot?.unreadNotifications ?? 0, bookmarks, performance }
  const enabledWidgets = useMemo(() => widgets.filter(widget => widget.isEnabled && widget.widgetType !== 'search' && widgetRegistry[widget.widgetType]), [widgets])
  const searchEnabled = widgets.some(widget => widget.widgetType === 'search' && widget.isEnabled)

  useEffect(() => { const timer = window.setInterval(() => setClock(new Date()), 30_000); return () => window.clearInterval(timer) }, [])
  useEffect(() => { const controller = new AbortController(); Promise.all([fetchDashboard(controller.signal), fetchPerformance(controller.signal)]).then(([dash, metrics]) => { setSnapshot(dash); setPerformance(metrics); setConnection('online') }).catch(() => setConnection('offline')); return () => controller.abort() }, [])
  useEffect(() => { let source: EventSource | undefined; let retry: number | undefined; let stopped = false; const connect = () => { source = openEvents(event => { try { if ((JSON.parse(event.data) as { type: string }).type !== 'heartbeat') fetchDashboard().then(setSnapshot).catch(() => setConnection('stale')) } catch { /* ignore malformed events */ } }, state => { if (state === 'connected') setConnection('online'); else if (state === 'reconnecting') setConnection('stale'); else { setConnection('offline'); if (!stopped) retry = window.setTimeout(connect, 5000) } }) }; connect(); return () => { stopped = true; source?.close(); if (retry) window.clearTimeout(retry) } }, [])
  useEffect(() => { let cancelled = false; fetchProfiles().then(result => { const chosen = result.profiles.find(item => item.profileKey === 'desktop') ?? result.profiles[0]; if (chosen && !cancelled) setProfile(chosen) }).catch(() => undefined); fetchWidgetDefinitions().then(result => { if (!cancelled) setDefinitions(result.widgets) }).catch(() => undefined); return () => { cancelled = true } }, [])
  useEffect(() => { if (!profile) return; let cancelled = false; Promise.all([fetchWidgets(profile.id), fetchBookmarks(profile.id)]).then(async ([result, bookmarkResult]) => { if (cancelled) return; setBookmarks(bookmarkResult.bookmarks); if (result.widgets.length) { setWidgets(result.widgets); return }
    const available = await fetchWidgetDefinitions().catch(() => ({ widgets: [] as WidgetDefinition[] }))
    const initial = ['search', 'bookmarks', 'notifications', 'homelab-performance'].flatMap(type => { const definition = available.widgets.find(item => item.type === type); return definition ? [{ definition, type }] : [] })
    let cursorX = 0; let cursorY = 0; let rowHeight = 0
    const created = await Promise.all(initial.map(({ definition, type }) => { const width = Math.min(8, definition.initialSize.w); const height = definition.initialSize.h; if (cursorX + width > 8) { cursorX = 0; cursorY += rowHeight; rowHeight = 0 } const layout = { x: cursorX, y: cursorY, width, height }; cursorX += width; rowHeight = Math.max(rowHeight, height); return createWidget(profile.id, type, definition.defaultConfiguration, layout).catch(() => null) }))
    if (!cancelled) setWidgets(created.filter((widget): widget is Widget => widget !== null))
  }).catch(() => undefined); return () => { cancelled = true } }, [profile])

  const saveWidgets = (next: Widget[]) => {
    setWidgets(next); setSaveState('saving')
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      Promise.all(next.map(widget => updateWidget(widget.id, { layout: widget.layout, configuration: widget.configuration, isEnabled: widget.isEnabled }, widget.updatedAt)))
        .then(saved => { setWidgets(current => current.map(widget => { const response = saved.find(item => item.id === widget.id); const sent = next.find(item => item.id === widget.id); return response && sent && JSON.stringify(widget.layout) === JSON.stringify(sent.layout) && JSON.stringify(widget.configuration) === JSON.stringify(sent.configuration) ? { ...widget, updatedAt: response.updatedAt } : widget })); setSaveState('saved') })
        .catch(() => setSaveState('error'))
    }, 450)
  }
  const addWidget = async (definition: WidgetDefinition) => {
    if (!profile) return
    const offset = widgets.reduce((max, widget) => Math.max(max, widget.layout.y + widget.layout.height), 0)
    const width = definition.initialSize.w; const height = definition.initialSize.h
    try { const created = await createWidget(profile.id, definition.type, definition.defaultConfiguration, { x: 0, y: offset, width, height }); setWidgets(current => [...current, created]); setShowCatalog(false) }
    catch { setSaveState('error') }
  }
  const removeWidget = async (widget: Widget) => { try { await deleteWidget(widget.id); setWidgets(current => current.filter(item => item.id !== widget.id)) } catch { setSaveState('error') } }
  const updateConfiguration = (widget: Widget, configuration: Record<string, unknown>) => { setSettingsWidget(null); saveWidgets(widgets.map(item => item.id === widget.id ? { ...item, configuration } : item)) }
  const removeBookmark = async (bookmark: Bookmark) => { try { await deleteBookmark(bookmark.id); setBookmarks(current => current.filter(item => item.id !== bookmark.id)) } catch { setSaveState('error') } }
  const bookmarkSaved = (saved: Bookmark) => setBookmarks(current => bookmarkDialog?.bookmark ? current.map(item => item.id === saved.id ? saved : item) : [...current, saved])
  const timeLabel = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(clock)
  const dateLabel = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(clock)

  return <main className="app-frame">
    <aside className="sidebar"><a href="/" className="brand-lockup"><span className="brand-symbol">H</span><span>HOMEDASH<small>PERSONAL DASHBOARD</small></span></a><div className="side-label">WORKSPACE</div><button className="nav-item active"><span className="nav-icon">▦</span> Mi dashboard <span className="nav-tail">⌘1</span></button><div className="side-bottom"><div className="side-status"><span className={`status-lamp ${connection}`} />{connection === 'online' ? 'Todos los sistemas listos' : connection === 'loading' ? 'Conectando…' : connection === 'stale' ? 'Reconectando' : 'API sin conexión'}</div><div className="account-row"><span className="avatar">{user.username.slice(0, 1).toUpperCase()}</span><span className="account-copy"><strong>{user.username}</strong><small>Administrador</small></span><button className="icon-action" onClick={onLogout} aria-label="Cerrar sesión" title="Cerrar sesión">↗</button></div></div></aside>
    <section className="main-area"><header className="topbar"><div className="breadcrumbs"><span>Workspace</span><b>/</b><strong>Mi dashboard</strong></div><div className="top-actions"><span className={`sync-state ${saveState}`}><i />{saveState === 'saving' ? 'Guardando' : saveState === 'error' ? 'Error al guardar' : 'Sincronizado'}</span><button className="button button-edit" onClick={() => setEditing(value => !value)}>{editing ? 'Listo' : 'Editar dashboard'}<span>{editing ? '✓' : '✎'}</span></button></div></header>
      <div className="page-content"><section className="welcome"><div><p className="kicker">{dateLabel}</p><h1>Buenos días, {user.username}<span>.</span></h1><p className="subtle">Todo lo importante de tu homelab, a un vistazo.</p></div><div className="clock-block"><strong>{timeLabel}</strong><span>HORA LOCAL</span></div></section>
      {searchEnabled && <section className="search-hero"><div className="search-glyph">⌕</div><form onSubmit={event => { event.preventDefault(); const form = event.currentTarget; const input = form.elements.namedItem('query') as HTMLInputElement; const search = widgets.find(widget => widget.widgetType === 'search'); const provider = String(search?.configuration.provider ?? 'google'); const base = provider === 'duckduckgo' ? 'https://duckduckgo.com/?q=' : 'https://www.google.com/search?q='; if (input.value.trim()) window.open(`${base}${encodeURIComponent(input.value.trim())}`, search?.configuration.openInNewTab === false ? '_self' : '_blank', 'noopener,noreferrer') }}><input name="query" placeholder="Busca en la web o escribe una dirección…" aria-label="Buscar en la web"/><button type="submit" aria-label="Buscar">↗</button></form><kbd>ENTER</kbd></section>}
      <div className="section-heading"><div><p className="kicker">TU ESPACIO</p><h2>Widgets <span>{enabledWidgets.length.toString().padStart(2, '0')}</span></h2></div>{editing && <button className="button button-add" onClick={() => setShowCatalog(true)}><b>＋</b> Añadir widget</button>}</div>
      {editing && <div className="edit-banner"><span className="edit-banner-icon">✦</span><span><strong>Modo edición activo</strong><small>Añade widgets o ajusta su posición y tamaño. Los cambios se guardan automáticamente.</small></span><button onClick={() => setShowCatalog(true)}>Explorar widgets <b>→</b></button></div>}
      {!enabledWidgets.length ? <div className="empty-dashboard"><span>▦</span><h3>Tu dashboard empieza aquí</h3><p>Añade widgets para tener todo tu homelab a mano.</p><button className="button button-primary" onClick={() => { setEditing(true); setShowCatalog(true) }}>Explorar widgets</button></div> : <section className={`widget-grid ${editing ? 'editing' : ''}`} aria-label="Widgets del dashboard">{enabledWidgets.map(widget => {
        const definition = widgetRegistry[widget.widgetType]
        const min = definition?.minSize ?? { width: 2, height: 1 }
        const props = { data, state: connection === 'offline' ? 'offline' as const : connection === 'stale' ? 'stale' as const : snapshot ? 'ready' as const : 'loading' as const, message: snapshot?.sourceStates?.notifications, editing, configuration: widget.configuration, onBookmarkChange: () => setBookmarkDialog({}), onBookmarkDelete: removeBookmark, onBookmarkEdit: (bookmark: Bookmark) => setBookmarkDialog({ bookmark }) }
        return <article key={widget.id} className={`widget-shell ${editing ? 'is-editing' : ''}`} style={{ gridColumn: `${widget.layout.x + 1} / span ${widget.layout.width}`, gridRow: `${widget.layout.y + 1} / span ${widget.layout.height}` }}>
          {editing && <div className="widget-toolbar"><span className="drag-grip" title="Posición">⠿</span><strong>{definition?.type.replaceAll('-', ' ')}</strong><div className="widget-toolbar-actions"><button onClick={() => setSettingsWidget(widget)} aria-label="Configurar widget" title="Configurar">⚙</button><button onClick={() => saveWidgets(moveWidget(widgets, widget.id, { ...widget.layout, y: widget.layout.y + 1 }, min))} aria-label="Mover widget abajo" title="Mover abajo">↓</button><button onClick={() => saveWidgets(moveWidget(widgets, widget.id, { ...widget.layout, width: Math.min(8, widget.layout.width + 1) }, min))} aria-label="Ampliar widget" title="Ampliar">↗</button><button className="remove-widget" onClick={() => void removeWidget(widget)} aria-label="Quitar widget" title="Quitar">×</button></div></div>}
          {definition?.render({ ...props, onBookmarkChange: props.onBookmarkChange, onBookmarkDelete: props.onBookmarkDelete, onBookmarkEdit: props.onBookmarkEdit })}
        </article>
      })}</section>}
      <footer className="page-footer"><span>HOMEDASH <b>·</b> YOUR HOMELAB, AT A GLANCE</span><span><i className={`status-lamp ${connection}`} />{connection === 'online' ? 'CONEXIÓN SEGURA' : connection.toUpperCase()}</span></footer></div>
    </section>
    {showCatalog && <WidgetCatalog definitions={definitions} widgets={widgets} onClose={() => setShowCatalog(false)} onAdd={addWidget} />}
    {bookmarkDialog && profile && <BookmarkDialog profileId={profile.id} bookmark={bookmarkDialog.bookmark} onClose={() => setBookmarkDialog(null)} onSaved={bookmarkSaved} />}
    {settingsWidget && <WidgetSettings widget={settingsWidget} onClose={() => setSettingsWidget(null)} onSave={configuration => updateConfiguration(settingsWidget, configuration)} />}
  </main>
}

function WidgetCatalog({ definitions, widgets, onClose, onAdd }: { definitions: WidgetDefinition[]; widgets: Widget[]; onClose: () => void; onAdd: (definition: WidgetDefinition) => void }) {
  const labels: Record<string, { title: string; description: string; icon: string }> = { search: { title: 'Buscador', description: 'Busca rápidamente en la web.', icon: '⌕' }, bookmarks: { title: 'Marcadores', description: 'Tus accesos rápidos y enlaces favoritos.', icon: '↗' }, notifications: { title: 'Notificaciones', description: 'Actividad reciente de Notification Center.', icon: '◉' }, 'homelab-performance': { title: 'Rendimiento', description: 'CPU, memoria y estado de métricas.', icon: '⌁' }, 'service-status': { title: 'Estado de servicios', description: 'Disponibilidad de servicios del homelab.', icon: '◌' } }
  return <div className="overlay catalog-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><section className="catalog-panel"><div className="catalog-header"><div><p className="kicker">PERSONALIZA TU ESPACIO</p><h2>Biblioteca de widgets</h2><p className="subtle">Elige lo que quieres tener a mano.</p></div><button className="close-button" onClick={onClose} aria-label="Cerrar">×</button></div><div className="catalog-grid">{definitions.map(definition => { const info = labels[definition.type] ?? { title: definition.type, description: 'Widget HomeDash', icon: '◇' }; const active = widgets.some(widget => widget.widgetType === definition.type && widget.isEnabled); return <article className="catalog-card" key={definition.type}><div className="catalog-card-top"><span className="catalog-icon">{info.icon}</span><span className="catalog-size">{definition.initialSize.w} × {definition.initialSize.h}</span></div><h3>{info.title}</h3><p>{info.description}</p><button disabled={active} className={active ? 'added-button' : 'button button-add'} onClick={() => onAdd(definition)}>{active ? 'Añadido ✓' : '＋ Añadir widget'}</button></article> })}</div><div className="catalog-foot">Los widgets se pueden quitar y volver a añadir en cualquier momento.</div></section></div>
}

function App() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [checking, setChecking] = useState(true)
  useEffect(() => { getSession().then(result => setUser(result.user)).catch(() => setUser(null)).finally(() => setChecking(false)) }, [])
  if (checking) return <main className="login-page"><div className="login-card loading-card"><span className="brand-symbol">H</span><p>Abriendo tu dashboard…</p></div></main>
  if (!user) return <LoginScreen onAuthenticated={setUser} />
  return <Dashboard user={user} onLogout={async () => { await logout().catch(() => undefined); setUser(null) }} />
}

export default App
