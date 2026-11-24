import * as React from 'react'
import type { WidgetRenderProps } from './types'

const CLOCK_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'short',
  day: 'numeric'
})

export function ClockHeroWidget({ configuration }: WidgetRenderProps) {
  const [now, setNow] = React.useState(() => new Date())
  const clockStyle = String(configuration?.clockStyle ?? 'digital-modern')
  const showSeconds = configuration?.showSeconds === true
  const format24h = configuration?.format24h !== false

  React.useEffect(() => {
    const interval = clockStyle === 'analog-minimal' || showSeconds ? 1000 : 10000
    const tick = () => {
      if (!document.hidden) setNow(new Date())
    }
    const timer = setInterval(tick, interval)
    const onVisibility = () => { if (!document.hidden) setNow(new Date()) }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [clockStyle, showSeconds])

  const hours = now.getHours()
  const displayHours = format24h ? hours.toString().padStart(2, '0') : ((hours % 12 || 12).toString())
  const minutes = now.getMinutes().toString().padStart(2, '0')
  const seconds = now.getSeconds().toString().padStart(2, '0')
  const ampm = format24h ? '' : (hours >= 12 ? 'PM' : 'AM')

  const dateStr = CLOCK_DATE_FORMATTER.format(now)

  if (clockStyle === 'analog-minimal') {
    const secDeg = (now.getSeconds() / 60) * 360
    const minDeg = ((now.getMinutes() + now.getSeconds() / 60) / 60) * 360
    const hrDeg = (((now.getHours() % 12) + now.getMinutes() / 60) / 12) * 360

    return (
      <section className="widget-card clock-hero-widget style-analog">
        <div className="analog-clock-dial">
          <svg viewBox="0 0 100 100" className="analog-clock-svg" aria-label="Analog Clock">
            <circle cx="50" cy="50" r="46" className="analog-face" />
            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(deg => (
              <line
                key={deg}
                x1="50"
                y1="8"
                x2="50"
                y2={deg % 90 === 0 ? '13' : '11'}
                transform={`rotate(${deg} 50 50)`}
                className={deg % 90 === 0 ? 'analog-tick-major' : 'analog-tick-minor'}
              />
            ))}
            <line
              x1="50"
              y1="50"
              x2="50"
              y2="24"
              className="analog-hand analog-hour-hand"
              transform={`rotate(${hrDeg} 50 50)`}
            />
            <line
              x1="50"
              y1="50"
              x2="50"
              y2="15"
              className="analog-hand analog-minute-hand"
              transform={`rotate(${minDeg} 50 50)`}
            />
            <line
              x1="50"
              y1="54"
              x2="50"
              y2="13"
              className="analog-hand analog-second-hand"
              transform={`rotate(${secDeg} 50 50)`}
            />
            <circle cx="50" cy="50" r="2.5" className="analog-pivot" />
          </svg>
        </div>
        <div className="analog-date-label">{dateStr}</div>
      </section>
    )
  }

  if (clockStyle === 'world-clocks') {
    const utcHours = (now.getUTCHours()).toString().padStart(2, '0')
    const utcMinutes = (now.getUTCMinutes()).toString().padStart(2, '0')

    return (
      <section className="widget-card clock-hero-widget style-world">
        <div className="world-clocks-grid">
          <div className="world-clock-col local">
            <span className="world-clock-badge">LOCAL</span>
            <strong className="world-clock-time">{displayHours}:{minutes}</strong>
            <small>{dateStr}</small>
          </div>
          <div className="world-clock-divider" />
          <div className="world-clock-col utc">
            <span className="world-clock-badge">UTC</span>
            <strong className="world-clock-time">{utcHours}:{utcMinutes}</strong>
            <small>Universal Time</small>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="widget-card clock-hero-widget style-digital">
      <div className="digital-time-wrap">
        <span className="digital-hours-mins">
          {displayHours}:{minutes}
        </span>
        {showSeconds && <span className="digital-seconds">:{seconds}</span>}
        {ampm && <span className="digital-ampm">{ampm}</span>}
      </div>
      <div className="digital-date-badge">{dateStr}</div>
    </section>
  )
}

export function CountdownEventWidget({ configuration }: WidgetRenderProps) {
  const [currentTimestamp, setCurrentTimestamp] = React.useState(() => Date.now())
  const title = String(configuration?.title || 'Target Event')
  const targetDateStr = String(configuration?.targetDate || '')
  const icon = String(configuration?.icon || '🎯')
  const countdownStyle = String(configuration?.countdownStyle ?? 'hero-counter')

  React.useEffect(() => {
    const interval = countdownStyle === 'compact-badge' ? 60_000 : 1000
    const tick = () => {
      if (!document.hidden) setCurrentTimestamp(Date.now())
    }
    const timer = setInterval(tick, interval)
    const onVisibility = () => { if (!document.hidden) setCurrentTimestamp(Date.now()) }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [countdownStyle])

  if (!targetDateStr) {
    return (
      <section className="widget-card countdown-widget empty-config">
        <span className="countdown-icon-hero">{icon}</span>
        <strong className="countdown-event-title">{title}</strong>
        <p className="countdown-hint">Click ✎ to set target date/time</p>
      </section>
    )
  }

  const target = new Date(targetDateStr).getTime()
  const diff = target - currentTimestamp

  if (diff <= 0) {
    return (
      <section className="widget-card countdown-widget is-reached">
        <span className="countdown-icon-hero">🎉</span>
        <strong className="countdown-event-title">{title}</strong>
        <div className="countdown-reached-badge">Event reached!</div>
      </section>
    )
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)

  if (countdownStyle === 'compact-badge') {
    return (
      <section className="widget-card countdown-widget style-compact-badge">
        <span className="countdown-icon-badge">{icon}</span>
        <div className="countdown-compact-meta">
          <strong className="countdown-compact-title">{title}</strong>
          <span className="countdown-compact-days">
            <strong>{days}</strong> {days === 1 ? 'day' : 'days'} left
          </span>
        </div>
      </section>
    )
  }

  if (countdownStyle === 'progress-bar') {
    const startDateStr = String(configuration?.startDate || '')
    let progressPercent = 50
    if (startDateStr) {
      const start = new Date(startDateStr).getTime()
      const total = target - start
      if (total > 0) {
        progressPercent = Math.min(100, Math.max(0, Math.round(((currentTimestamp - start) / total) * 100)))
      }
    }

    return (
      <section className="widget-card countdown-widget style-progress">
        <div className="countdown-header-row">
          <span className="countdown-icon-small">{icon}</span>
          <strong className="countdown-event-title">{title}</strong>
        </div>
        <div className="countdown-digits-strip">
          <span className="strip-val"><strong>{days}</strong>d</span>
          <span className="strip-val"><strong>{hours}</strong>h</span>
          <span className="strip-val"><strong>{minutes}</strong>m</span>
          <span className="strip-val"><strong>{seconds}</strong>s</span>
        </div>
        <div className="countdown-progress-track">
          <div className="countdown-progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
        <div className="countdown-progress-label">
          <span>{progressPercent}% elapsed</span>
          <small>{new Date(targetDateStr).toLocaleDateString()}</small>
        </div>
      </section>
    )
  }

  return (
    <section className="widget-card countdown-widget style-hero-counter">
      <div className="countdown-header-row">
        <span className="countdown-icon-small">{icon}</span>
        <strong className="countdown-event-title">{title}</strong>
      </div>
      <div className="countdown-boxes-grid">
        <div className="countdown-digit-box">
          <span className="digit-num">{days}</span>
          <span className="digit-unit">DAYS</span>
        </div>
        <div className="countdown-digit-box">
          <span className="digit-num">{hours}</span>
          <span className="digit-unit">HOURS</span>
        </div>
        <div className="countdown-digit-box">
          <span className="digit-num">{minutes}</span>
          <span className="digit-unit">MIN</span>
        </div>
        <div className="countdown-digit-box">
          <span className="digit-num">{seconds}</span>
          <span className="digit-unit">SEC</span>
        </div>
      </div>
      <div className="countdown-target-label">
        Target: {new Date(targetDateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
      </div>
    </section>
  )
}

type ChecklistItem = { id: string; text: string; done: boolean }

export function StickyNoteWidget({ configuration, onConfigurationChange, editing }: WidgetRenderProps) {
  const noteType = String(configuration?.noteType ?? 'text')
  const pinColor = String(configuration?.pinColor ?? 'blue')
  const rawContent = String(configuration?.content ?? '')
  const [newChecklistText, setNewChecklistText] = React.useState('')

  const checklistItems = React.useMemo<ChecklistItem[]>(() => {
    if (noteType !== 'checklist') return []
    try {
      if (rawContent.startsWith('[')) {
        return JSON.parse(rawContent) as ChecklistItem[]
      }
    } catch {
      // fallback
    }
    return rawContent.split('\n').filter(Boolean).map((line, idx) => ({
      id: `item-${idx}`,
      text: line.replace(/^\[[ xX]\]\s*/, ''),
      done: line.startsWith('[x]') || line.startsWith('[X]')
    }))
  }, [noteType, rawContent])

  const toggleItem = (id: string) => {
    const next = checklistItems.map(item => item.id === id ? { ...item, done: !item.done } : item)
    onConfigurationChange?.({
      ...configuration,
      content: JSON.stringify(next)
    })
  }

  const addItem = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newChecklistText.trim()
    if (!trimmed) return
    const next = [...checklistItems, { id: `item-${Date.now()}`, text: trimmed, done: false }]
    onConfigurationChange?.({
      ...configuration,
      content: JSON.stringify(next)
    })
    setNewChecklistText('')
  }

  const deleteItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const next = checklistItems.filter(item => item.id !== id)
    onConfigurationChange?.({
      ...configuration,
      content: JSON.stringify(next)
    })
  }

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onConfigurationChange?.({
      ...configuration,
      content: e.target.value
    })
  }

  return (
    <section className={`widget-card sticky-note-widget color-${pinColor} type-${noteType}`}>
      <div className="sticky-pin-header">
        <span className={`sticky-pin pin-${pinColor}`} />
        <span className="sticky-note-tag">{noteType === 'checklist' ? 'Checklist' : 'Quick Note'}</span>
      </div>

      {noteType === 'text' ? (
        <textarea
          className="sticky-note-textarea"
          value={rawContent}
          onChange={handleTextChange}
          placeholder="Jot down notes, commands, IP addresses, or thoughts here…"
          disabled={editing}
        />
      ) : (
        <div className="sticky-checklist-container">
          <div className="sticky-checklist-items">
            {checklistItems.map(item => (
              <div
                key={item.id}
                className={`checklist-item-row ${item.done ? 'is-done' : ''}`}
                onClick={() => !editing && toggleItem(item.id)}
              >
                <span className={`custom-checkbox ${item.done ? 'checked' : ''}`}>
                  {item.done && '✓'}
                </span>
                <span className="checklist-item-text">{item.text}</span>
                {!editing && (
                  <button
                    type="button"
                    className="checklist-del-btn"
                    onClick={e => deleteItem(item.id, e)}
                    title="Remove item"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {!checklistItems.length && (
              <p className="checklist-empty">No tasks yet. Add one below!</p>
            )}
          </div>
          {!editing && (
            <form onSubmit={addItem} className="checklist-add-form">
              <input
                value={newChecklistText}
                onChange={e => setNewChecklistText(e.target.value)}
                placeholder="+ Add task…"
                className="checklist-input"
              />
            </form>
          )}
        </div>
      )}
    </section>
  )
}
