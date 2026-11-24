import * as React from 'react'
import type { Bookmark } from '../api'
import { BookmarkFavicon } from './shared'
import type { WidgetRenderProps } from './types'

export function SingleBookmarkWidget({ data, editing, configuration }: WidgetRenderProps) {
  const bookmarkId = String(configuration?.bookmarkId ?? '')
  const found = data.bookmarks.find(b => b.id === bookmarkId) || data.bookmarks[0]

  const title = String(configuration?.title || found?.name || 'Quick Access')
  const url = String(configuration?.url || found?.url || '')
  const icon = String(configuration?.icon || found?.icon || '')
  const subtitle = String(configuration?.subtitle || found?.category || (url ? (() => { try { return new URL(url).hostname } catch { return '' } })() : ''))
  const inNewTab = configuration?.openInNewTab !== false

  const handleClick = (e: React.MouseEvent) => {
    if (editing || !url) return
    const target = e.target as HTMLElement
    if (target.closest('.widget-toolbar, .resize-handle')) return
    window.open(url, inNewTab ? '_blank' : '_self', 'noopener,noreferrer')
  }

  return (
    <article
      className={`widget-card single-bookmark-card ${url && !editing ? 'is-clickable' : ''}`}
      onClick={handleClick}
      title={url ? `${title} · ${url}` : title}
    >
      <div className="single-bookmark-inner">
        <div className="single-bookmark-icon-hero">
          <BookmarkFavicon url={url} icon={icon} name={title}/>
        </div>
        <div className="single-bookmark-meta">
          <strong className="single-bookmark-name">{title}</strong>
          {subtitle && <small className="single-bookmark-host">{subtitle}</small>}
        </div>
      </div>
      {url && <span className="single-bookmark-arrow" aria-hidden="true">↗</span>}
    </article>
  )
}

export function BookmarksWidget({ widgetId, data, editing, configuration, onBookmarkChange, onBookmarkDelete, onBookmarkEdit, onBookmarkReorder }: WidgetRenderProps) {
  const bookmarkStyle = String(configuration?.bookmarkStyle ?? 'tiles')
  const iconSize = String(configuration?.iconSize ?? 'normal')
  const categoryFilter = String(configuration?.categoryFilter ?? 'all')
  const [draggedId, setDraggedId] = React.useState<string | null>(null)
  const [dragOverId, setDragOverId] = React.useState<string | null>(null)

  const widgetBookmarks = React.useMemo(
    () => (widgetId ? data.bookmarks.filter(b => b.widgetId === widgetId) : data.bookmarks),
    [data.bookmarks, widgetId]
  )

  const bookmarksToRender = React.useMemo(
    () =>
      categoryFilter === 'all'
        ? widgetBookmarks
        : widgetBookmarks.filter(b => (b.category || '').toLowerCase() === categoryFilter.toLowerCase()),
    [widgetBookmarks, categoryFilter]
  )

  const moveBookmark = (sourceId: string, targetId: string) => {
    if (!sourceId || !targetId || sourceId === targetId) return
    const list = [...widgetBookmarks]
    const fromIndex = list.findIndex(b => b.id === sourceId)
    const toIndex = list.findIndex(b => b.id === targetId)
    if (fromIndex === -1 || toIndex === -1) return
    const [moved] = list.splice(fromIndex, 1)
    list.splice(toIndex, 0, moved)
    onBookmarkReorder?.(list.map(b => b.id))
  }

  const stepBookmark = (bookmarkId: string, delta: -1 | 1) => {
    const visibleIdx = bookmarksToRender.findIndex(b => b.id === bookmarkId)
    const neighbor = bookmarksToRender[visibleIdx + delta]
    if (!neighbor) return
    moveBookmark(bookmarkId, neighbor.id)
  }

  const dragProps = (bookmarkId: string) =>
    editing
      ? {
          draggable: true,
          onDragStart: (e: React.DragEvent) => {
            e.stopPropagation()
            setDraggedId(bookmarkId)
            e.dataTransfer.effectAllowed = 'move'
            e.dataTransfer.setData('text/plain', bookmarkId)
          },
          onDragOver: (e: React.DragEvent) => {
            if (!draggedId || draggedId === bookmarkId) return
            e.preventDefault()
            e.stopPropagation()
            e.dataTransfer.dropEffect = 'move'
            if (dragOverId !== bookmarkId) setDragOverId(bookmarkId)
          },
          onDragLeave: () => {
            if (dragOverId === bookmarkId) setDragOverId(null)
          },
          onDrop: (e: React.DragEvent) => {
            e.preventDefault()
            e.stopPropagation()
            const sourceId = draggedId || e.dataTransfer.getData('text/plain')
            setDraggedId(null)
            setDragOverId(null)
            if (sourceId && sourceId !== bookmarkId) moveBookmark(sourceId, bookmarkId)
          },
          onDragEnd: () => {
            setDraggedId(null)
            setDragOverId(null)
          }
        }
      : {}

  const renderEditActions = (bookmark: Bookmark, index: number, total: number) => {
    if (!editing) return null
    const isVertical = bookmarkStyle === 'tiles'
    return (
      <div className="bookmark-edit-actions">
        <button
          type="button"
          onClick={() => stepBookmark(bookmark.id, -1)}
          disabled={index === 0}
          aria-label="Move earlier"
          title={isVertical ? 'Move up' : 'Move left'}
        >
          {isVertical ? '▲' : '‹'}
        </button>
        <button
          type="button"
          onClick={() => stepBookmark(bookmark.id, 1)}
          disabled={index === total - 1}
          aria-label="Move later"
          title={isVertical ? 'Move down' : 'Move right'}
        >
          {isVertical ? '▼' : '›'}
        </button>
        <button type="button" onClick={() => onBookmarkEdit?.(bookmark)} aria-label="Edit" title="Edit">✎</button>
        <button type="button" onClick={() => onBookmarkDelete?.(bookmark)} aria-label="Delete" title="Delete">×</button>
      </div>
    )
  }

  return (
    <section className={`widget-card bookmarks-widget style-${bookmarkStyle} size-${iconSize}`}>
      {editing && (
        <div className="bookmarks-edit-header">
          <button className="mini-action add-bookmark-btn" onClick={onBookmarkChange}>＋ Add link</button>
        </div>
      )}
      {!bookmarksToRender.length && (
        <p className="widget-empty">
          {categoryFilter !== 'all' ? `No bookmarks in category "${categoryFilter}".` : 'No bookmarks saved yet. Add your favorite links.'}
        </p>
      )}
      {bookmarksToRender.length > 0 && (
        <div className={`bookmark-layout ${bookmarkStyle}`}>
          {bookmarksToRender.map((bookmark, index) => {
            let host = ''
            try { host = new URL(bookmark.url).hostname } catch { host = '' }
            const stateClasses = `${editing ? 'is-editing-item' : ''} ${draggedId === bookmark.id ? 'is-dragging' : ''} ${dragOverId === bookmark.id ? 'is-drag-over' : ''}`

            if (bookmarkStyle === 'icons-only') {
              return (
                <div className={`bookmark-item icon-only-item ${stateClasses}`} key={bookmark.id} {...dragProps(bookmark.id)}>
                  <a href={bookmark.url} target="_blank" rel="noreferrer" className="bookmark-icon-anchor" title={bookmark.name} onClick={e => editing && e.preventDefault()}>
                    <BookmarkFavicon url={bookmark.url} icon={bookmark.icon} name={bookmark.name}/>
                    <span className="bookmark-floating-tooltip">{bookmark.name}</span>
                  </a>
                  {renderEditActions(bookmark, index, bookmarksToRender.length)}
                </div>
              )
            }

            if (bookmarkStyle === 'compact-chips') {
              return (
                <div className={`bookmark-item chip-item ${stateClasses}`} key={bookmark.id} {...dragProps(bookmark.id)}>
                  <a href={bookmark.url} target="_blank" rel="noreferrer" className="bookmark-chip-anchor" onClick={e => editing && e.preventDefault()}>
                    <BookmarkFavicon url={bookmark.url} icon={bookmark.icon} name={bookmark.name}/>
                    <span className="bookmark-chip-title">{bookmark.name}</span>
                  </a>
                  {renderEditActions(bookmark, index, bookmarksToRender.length)}
                </div>
              )
            }

            if (bookmarkStyle === 'dock') {
              return (
                <div className={`bookmark-item dock-item ${stateClasses}`} key={bookmark.id} {...dragProps(bookmark.id)}>
                  <a href={bookmark.url} target="_blank" rel="noreferrer" className="bookmark-dock-anchor" title={bookmark.name} onClick={e => editing && e.preventDefault()}>
                    <BookmarkFavicon url={bookmark.url} icon={bookmark.icon} name={bookmark.name}/>
                    <span className="bookmark-dock-label">{bookmark.name}</span>
                  </a>
                  {renderEditActions(bookmark, index, bookmarksToRender.length)}
                </div>
              )
            }

            return (
              <div className={`bookmark-tile ${stateClasses}`} key={bookmark.id} {...dragProps(bookmark.id)}>
                <a href={bookmark.url} target="_blank" rel="noreferrer" onClick={e => editing && e.preventDefault()}>
                  <BookmarkFavicon url={bookmark.url} icon={bookmark.icon} name={bookmark.name}/>
                  <span className="bookmark-copy">
                    <strong>{bookmark.name}</strong>
                    <small>{bookmark.category ?? host}</small>
                  </span>
                  <b aria-hidden="true" className="tile-arrow">↗</b>
                </a>
                {renderEditActions(bookmark, index, bookmarksToRender.length)}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
