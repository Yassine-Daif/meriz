import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Logo } from './Logo'
import { UiScaleControl } from './UiScaleControl'
import { secondaryButtonClass } from './buttonStyles'

interface PageShellProps {
  title: string
  /** Change quand le contenu change de sujet : le titre reprend le focus. */
  focusKey?: string
  onBack: () => void
  backLabel?: string
  children: ReactNode
}

/**
 * Coquille des écrans de compte (profil, classes) : en-tête Meriz, retour
 * à l'accueil, et un titre qui reçoit le focus à l'arrivée pour situer
 * l'utilisateur au clavier et au lecteur d'écran.
 */
export function PageShell({ title, focusKey, onBack, backLabel = "Retour à l'accueil", children }: PageShellProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [focusKey, title])

  return (
    <div className="h-dvh overflow-y-auto bg-shell font-sans text-ink">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10 focus:rounded focus:bg-indigo-700 focus:px-3 focus:py-2 focus:text-white"
      >
        Aller au contenu
      </a>
      <header className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-4 py-2">
        <Logo />
        <span className="text-base font-semibold tracking-tight">Meriz</span>
        <button type="button" onClick={onBack} className={`${secondaryButtonClass} ml-3 py-1.5`}>
          <span aria-hidden="true">← </span>
          {backLabel}
        </button>
        <div className="ml-auto">
          <UiScaleControl />
        </div>
      </header>
      <main id="contenu" className="mx-auto w-full max-w-3xl px-6 py-8">
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold tracking-tight">
          {title}
        </h1>
        <div className="mt-5">{children}</div>
      </main>
    </div>
  )
}
