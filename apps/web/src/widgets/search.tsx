import * as React from 'react'
import type { WidgetRenderProps } from './types'

type SearchProviderKey = 'google' | 'duckduckgo' | 'bing' | 'brave' | 'github' | 'youtube'

type SearchProviderDef = {
  label: string
  url: string
  icon: React.ReactNode
}

const SEARCH_PROVIDERS: Record<SearchProviderKey, SearchProviderDef> = {
  google: {
    label: 'Google',
    url: 'https://www.google.com/search?q=',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="engine-svg">
        <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"/>
        <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z"/>
        <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12c0 1.96.45 3.82 1.25 5.42l4.03-3.15Z"/>
        <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"/>
      </svg>
    )
  },
  duckduckgo: {
    label: 'DuckDuckGo',
    url: 'https://duckduckgo.com/?q=',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="engine-svg">
        <circle cx="12" cy="12" r="10" fill="#DE5833"/>
        <path fill="#FFF" d="M17.5 13.5c-.4 1.8-2 3.1-4 3.1-1.3 0-2.4-.6-3.1-1.5-.4-.5-.9-.6-1.5-.3-.7.3-1.2 1-1.2 1.8 0 .8.6 1.5 1.4 1.7 1.4.3 2.9.5 4.4.5 4.1 0 7.5-3.4 7.5-7.5 0-.4 0-.8-.1-1.2-.4.6-1.5 1-2.4 1.2-.4.1-.8.6-1 1.2Z"/>
        <circle cx="10" cy="10" r="1.5" fill="#FFF"/>
      </svg>
    )
  },
  bing: {
    label: 'Bing',
    url: 'https://www.bing.com/search?q=',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="engine-svg">
        <path fill="#008373" d="m5 3 4.5 1.5v12.7l6.5-3.7-3.2-1.6 4.7-4.9h-8L5 3Z"/>
        <path fill="#00A4EF" d="m16 13.5-6.5 3.7v3.8l9.5-5.5-3-2Z"/>
      </svg>
    )
  },
  brave: {
    label: 'Brave',
    url: 'https://search.brave.com/search?q=',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="engine-svg">
        <path fill="#FB542B" d="M12 2 3 5.5v6.2c0 5.4 3.8 10.4 9 11.8 5.2-1.4 9-6.4 9-11.8V5.5L12 2Zm5.5 10.2-2.1 1.8.6 2.8-2.5-1.5-2.5 1.5.6-2.8-2.1-1.8 2.8-.3 1.2-2.6 1.2 2.6 2.8.3Z"/>
      </svg>
    )
  },
  github: {
    label: 'GitHub',
    url: 'https://github.com/search?q=',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="engine-svg">
        <path fill="#FFF" fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z"/>
      </svg>
    )
  },
  youtube: {
    label: 'YouTube',
    url: 'https://www.youtube.com/results?search_query=',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="engine-svg">
        <path fill="#FF0000" d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814Z"/>
        <path fill="#FFF" d="m9.545 15.568 6.273-3.568-6.273-3.568v7.136Z"/>
      </svg>
    )
  }
}

export function SearchWidget({ configuration }: WidgetRenderProps) {
  const [query, setQuery] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  const providerKey = (String(configuration?.provider ?? 'google') as SearchProviderKey)
  const provider = SEARCH_PROVIDERS[providerKey] ?? SEARCH_PROVIDERS.google
  const searchStyle = String(configuration?.searchStyle ?? 'pill')
  const isCompact = searchStyle === 'compact' || searchStyle === 'minimal'
  const showEngineIcon = configuration?.showEngineIcon !== false && !isCompact

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const value = query.trim()
    if (!value) return
    const target = configuration?.openInNewTab === false ? '_self' : '_blank'
    window.open(`${provider.url}${encodeURIComponent(value)}`, target, 'noopener,noreferrer')
  }

  if (isCompact) {
    return (
      <form className={`widget-card search-widget style-compact ${searchStyle}`} onSubmit={submit} role="search">
        <svg className="search-leading-icon" aria-hidden="true" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="7"/>
          <path d="m20 20-4-4"/>
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder={`Search ${provider.label}…`}
          aria-label={`Search with ${provider.label}`}
        />
      </form>
    )
  }

  return (
    <form className={`widget-card search-widget style-${searchStyle}`} onSubmit={submit} role="search">
      {showEngineIcon ? (
        <span className="search-provider-badge" title={`Search with ${provider.label}`}>
          {provider.icon}
        </span>
      ) : (
        <svg className="search-leading-icon" aria-hidden="true" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="7"/>
          <path d="m20 20-4-4"/>
        </svg>
      )}
      <input
        ref={inputRef}
        value={query}
        onChange={event => setQuery(event.target.value)}
        placeholder={`Search with ${provider.label}…`}
        aria-label={`Search with ${provider.label}`}
      />
      <kbd className="search-shortcut">Ctrl K</kbd>
      <button type="submit" className="search-submit-button" aria-label="Search">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12h14M13 6l6 6-6 6"/>
        </svg>
      </button>
    </form>
  )
}
