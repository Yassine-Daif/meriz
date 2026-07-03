import type { ReactNode } from 'react'
import type { ViewId, ViewInfo } from './views'
import { FOOTER_VIEWS, VIEWS } from './views'

interface NavRailProps {
  activeView: ViewId
  onSelectView: (view: ViewId) => void
}

const iconProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

// Icônes dessinées en SVG en ligne : aucune dépendance.
const icons: Record<ViewId, ReactNode> = {
  accueil: (
    <svg {...iconProps}>
      <path d="m3 11.5 9-8 9 8" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M10 20v-6h4v6" />
    </svg>
  ),
  dictionnaire: (
    <svg {...iconProps}>
      <path d="M4 5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1-2-2Z" />
      <path d="M4 17a2 2 0 0 1 2-2h13" />
      <path d="M9 7h6" />
    </svg>
  ),
  mcd: (
    <svg {...iconProps}>
      <rect x="2.5" y="4" width="7" height="6" rx="1" />
      <rect x="14.5" y="14" width="7" height="6" rx="1" />
      <ellipse cx="12" cy="12" rx="3.5" ry="2.5" />
      <path d="M8.5 9.5 9.9 10.9M14.6 13.4l1.4 1.4" />
    </svg>
  ),
  mld: (
    <svg {...iconProps}>
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <path d="M3 9h18M9 9v11M3 14.5h18" />
    </svg>
  ),
  mpd: (
    <svg {...iconProps}>
      <ellipse cx="12" cy="5.5" rx="7.5" ry="2.8" />
      <path d="M4.5 5.5v13c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-13" />
      <path d="M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8" />
    </svg>
  ),
  sql: (
    <svg {...iconProps}>
      <path d="m8 8-4.5 4L8 16" />
      <path d="m16 8 4.5 4L16 16" />
      <path d="m13 5-2.5 14" />
    </svg>
  ),
  apprendre: (
    <svg {...iconProps}>
      <path d="m12 4-9.5 4.5L12 13l9.5-4.5Z" />
      <path d="M6 10.8v5c1.7 1.5 4 2.2 6 2.2s4.3-.7 6-2.2v-5" />
      <path d="M21.5 8.5V15" />
    </svg>
  ),
  apropos: (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <path d="M12 7.5v.2" />
    </svg>
  ),
}

interface RailItemProps {
  view: ViewInfo
  active: boolean
  onSelectView: (view: ViewId) => void
}

function RailItem({ view, active, onSelectView }: RailItemProps) {
  return (
    <li>
      <button
        type="button"
        aria-current={active ? 'page' : undefined}
        title={view.label}
        onClick={() => onSelectView(view.id)}
        className={`flex w-full items-center justify-center gap-2.5 rounded-md px-2.5 py-2 text-sm md:justify-start ${
          active ? 'bg-indigo-700 font-medium text-white' : 'text-zinc-700 hover:bg-zinc-200/60'
        }`}
      >
        <span aria-hidden="true">{icons[view.id]}</span>
        <span className="sr-only md:not-sr-only">{view.label}</span>
      </button>
    </li>
  )
}

/**
 * Rail de navigation vertical, équivalent moderne du Navigateur
 * d'AnalyseSI. Vues de travail en haut, Apprendre et À propos en
 * pied. Icônes seules sur écran étroit, libellés à partir de md.
 */
export function NavRail({ activeView, onSelectView }: NavRailProps) {
  return (
    <nav
      aria-label="Vues"
      className="flex w-14 shrink-0 flex-col border-r border-line bg-shell md:w-52"
    >
      <ul className="flex flex-col gap-1 p-2">
        {VIEWS.map((view) => (
          <RailItem
            key={view.id}
            view={view}
            active={view.id === activeView}
            onSelectView={onSelectView}
          />
        ))}
      </ul>
      <ul className="mt-auto flex flex-col gap-1 border-t border-line p-2">
        {FOOTER_VIEWS.map((view) => (
          <RailItem
            key={view.id}
            view={view}
            active={view.id === activeView}
            onSelectView={onSelectView}
          />
        ))}
      </ul>
    </nav>
  )
}
