import type { ReactNode } from 'react'

export type IconName =
  | 'grid'
  | 'edit'
  | 'check'
  | 'plus'
  | 'search'
  | 'settings'
  | 'move'
  | 'resize'
  | 'remove'
  | 'close'
  | 'arrow'
  | 'bookmark'
  | 'bell'
  | 'activity'
  | 'logout'
  | 'gear'

const ICON_PATHS: Record<IconName, ReactNode> = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4Z"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  plus: <path d="M12 5v14M5 12h14"/>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.1.9-1.1 1.9-1.3-.5a8 8 0 0 1-1.6.9l-.2 1.4h-2.2l-.2-1.4a8 8 0 0 1-1.7-.9l-1.3.5-1.1-1.9 1.1-.9a7 7 0 0 1 0-1.9l-1.1-.9 1.1-1.9 1.3.5a8 8 0 0 1 1.7-.9l.2-1.4h2.2l.2 1.4a8 8 0 0 1 1.6.9l1.3-.5 1.1 1.9-1.1.9a7 7 0 0 1-.1 1.8Z"/></>,
  move: <><path d="M12 2v20M2 12h20M12 2l-3 3m3-3 3 3M12 22l-3-3m3 3 3-3M2 12l3-3m-3 3 3 3M22 12l-3-3m3 3-3 3"/></>,
  resize: <><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3M21 16v3a2 2 0 0 1-2 2h-3"/></>,
  remove: <><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6"/></>,
  close: <path d="m18 6-12 12M6 6l12 12"/>,
  arrow: <><path d="M7 17 17 7M7 7h10v10"/></>,
  bookmark: <path d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18l-6-4-6 4z"/>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
  activity: <path d="M3 12h4l3-9 4 18 3-9h4"/>,
  logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></>,
  gear: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.7 2.9-.2-.1a1.7 1.7 0 0 0-1.9.2 1.7 1.7 0 0 0-.8 1.5v.3H9v-.3a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.8.2l-.2.1-1.7-2.9.2-.1a1.7 1.7 0 0 0 .7-1.7 1.7 1.7 0 0 0-1.2-1.3l-.3-.1v-3.4l.3-.1a1.7 1.7 0 0 0 1.2-1.3 1.7 1.7 0 0 0-.7-1.7l-.2-.1 1.7-2.9.2.1a1.7 1.7 0 0 0 1.8.2A1.7 1.7 0 0 0 9 3.6v-.3h6.2v.3a1.7 1.7 0 0 0 .8 1.5 1.7 1.7 0 0 0 1.9.2l.2-.1 1.7 2.9-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.4 1l.2.1v3.4l-.2.1a1.7 1.7 0 0 0-1.4 1z"/></>
}

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {ICON_PATHS[name]}
    </svg>
  )
}
