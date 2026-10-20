import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { UiScaleControl } from '../UiScaleControl'
import { BackButton } from './BackButton'
import { Card } from './Card'
import { Lockup } from './Lockup'
import { SkipLink } from './SkipLink'
import { EffectsControl } from './EffectsControl'
import { ThemeToggle } from './ThemeToggle'

interface PublicShellProps {
  title: string
  /** Phrase d'accroche sous le titre. */
  lede?: ReactNode
  /** Retour vers l'accueil, absent quand il n'y a nulle part où revenir. */
  onBack?: () => void
  backLabel?: string
  /** Change quand l'écran change de sujet : le titre reprend le focus. */
  focusKey?: string
  children: ReactNode
}

/**
 * Écran hors connexion : logo, thème, taille d'interface, puis une carte
 * centrée. Le titre prend le focus à l'arrivée, pour situer la personne
 * au clavier comme au lecteur d'écran.
 */
export function PublicShell({
  title,
  lede,
  onBack,
  backLabel = "Retour à l'accueil",
  focusKey,
  children,
}: PublicShellProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [focusKey, title])

  return (
    <div className="h-dvh overflow-y-auto bg-shell font-sans text-ink">
      <SkipLink />

      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface px-4 py-2.5 sm:px-6">
        <Lockup size={30} label="Meriz" />
        {onBack && <BackButton label={backLabel} onClick={onBack} />}
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <ThemeToggle />
          <EffectsControl />
          <UiScaleControl />
        </div>
      </header>

      <main id="contenu" className="meriz-page-enter mx-auto w-full max-w-md px-4 py-10 sm:py-14">
        <Card className="p-6 sm:p-8">
          <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {title}
          </h1>
          {lede && <p className="mt-1.5 text-sm leading-6 text-ink-soft">{lede}</p>}
          <div className="mt-6">{children}</div>
        </Card>
      </main>
    </div>
  )
}
