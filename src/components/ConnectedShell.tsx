import type { ReactNode } from 'react'
import type { ApiUser } from '../lib/authApi'
import { AccountStatus } from './AccountStatus'
import { UiScaleControl } from './UiScaleControl'
import { Button } from './ui/Button'
import { Lockup } from './ui/Lockup'
import { Notice } from './ui/Notice'
import { SkipLink } from './ui/SkipLink'
import { ThemeToggle } from './ui/ThemeToggle'

export type ConnectedPage = 'home' | 'classes' | 'work' | 'profile'

interface ConnectedShellProps {
  user: ApiUser
  page: ConnectedPage
  onNavigate: (page: ConnectedPage) => void
  /** Avis persistant de la session (travail mis de côté…). */
  notice: string | null
  onClearNotice: () => void
  children: ReactNode
}

/** Pictogrammes au trait, décoratifs : le libellé porte le sens. */
const ICONS: Record<ConnectedPage, ReactNode> = {
  home: <path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z" />,
  classes: (
    <>
      <circle cx="9" cy="9" r="3" />
      <path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5" />
      <circle cx="17" cy="8" r="2.4" />
      <path d="M16 12.6c2.4-.2 4 1.2 4.5 4" />
    </>
  ),
  work: <path d="M3.5 7a1.5 1.5 0 0 1 1.5-1.5h4.2l2 2.2H19A1.5 1.5 0 0 1 20.5 9.2V17.5A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z" />,
  profile: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 19.5c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
    </>
  ),
}

const ITEMS: { page: ConnectedPage; label: string }[] = [
  { page: 'home', label: 'Accueil' },
  { page: 'classes', label: 'Mes classes' },
  { page: 'work', label: 'Mon travail' },
  { page: 'profile', label: 'Profil' },
]

/**
 * Cadre de l'espace connecté : en-tête (logo, thème, taille, compte),
 * navigation principale en barre latérale sur grand écran et en onglets
 * sur petit écran, puis la page. La page courante est marquée par
 * aria-current, par le fond et par un trait, jamais par la couleur seule.
 */
export function ConnectedShell({ user, page, onNavigate, notice, onClearNotice, children }: ConnectedShellProps) {
  return (
    <div className="flex h-dvh flex-col bg-shell font-sans text-ink">
      <SkipLink />

      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface px-4 py-2.5 sm:px-6">
        <Lockup size={30} label="Meriz" />
        <span className="hidden text-sm font-medium text-ink-soft sm:inline">
          {user.role === 'teacher' ? 'Espace prof' : 'Espace élève'}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <ThemeToggle />
          <UiScaleControl />
          <AccountStatus compact />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <nav
          aria-label="Navigation principale"
          className="shrink-0 overflow-x-auto border-b border-line bg-surface lg:w-60 lg:overflow-x-visible lg:border-r lg:border-b-0"
        >
          <ul className="flex gap-1 px-3 py-2 lg:flex-col lg:px-3 lg:py-5">
            {ITEMS.map((item) => {
              const current = item.page === page
              return (
                <li key={item.page} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => onNavigate(item.page)}
                    aria-current={current ? 'page' : undefined}
                    className={`relative flex w-full items-center gap-2.5 rounded-control px-3.5 py-2.5 text-sm transition-colors duration-150 ${
                      current
                        ? 'bg-accent-soft font-semibold text-accent-ink'
                        : 'font-medium text-ink-soft hover:bg-surface-soft hover:text-ink'
                    }`}
                  >
                    {current && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-3 -bottom-2 h-1 rounded-full bg-mark lg:inset-x-auto lg:inset-y-2 lg:-left-3 lg:bottom-auto lg:h-auto lg:w-1"
                      />
                    )}
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      width="20"
                      height="20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="shrink-0"
                    >
                      {ICONS[item.page]}
                    </svg>
                    {item.label}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        <main id="contenu" className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 md:px-10">
            {notice && (
              <Notice
                tone="warning"
                className="mb-6"
                action={
                  <Button size="sm" onClick={onClearNotice}>
                    Compris
                  </Button>
                }
              >
                {notice}
              </Notice>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
