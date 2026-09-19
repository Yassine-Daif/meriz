import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Button } from './ui/Button'
import { PageHeader } from './ui/PageHeader'

interface PageShellProps {
  title: string
  eyebrow?: string
  description?: ReactNode
  /** Actions principales, à droite du titre sur grand écran. */
  actions?: ReactNode
  /** Change quand le contenu change de sujet : le titre reprend le focus. */
  focusKey?: string
  /** Retour vers un niveau au-dessus (ex. d'une classe à la liste). */
  onBack?: () => void
  backLabel?: string
  children: ReactNode
}

/**
 * Contenu d'une page de l'espace connecté : un titre qui reçoit le focus
 * à l'arrivée, pour situer l'utilisateur au clavier et au lecteur
 * d'écran, puis la page. La navigation vient de la coquille.
 */
export function PageShell({
  title,
  eyebrow,
  description,
  actions,
  focusKey,
  onBack,
  backLabel = 'Retour',
  children,
}: PageShellProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [focusKey, title])

  return (
    <div>
      {onBack && (
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-3 mb-3">
          <span aria-hidden="true">←</span>
          {backLabel}
        </Button>
      )}
      <PageHeader
        title={title}
        eyebrow={eyebrow}
        description={description}
        actions={actions}
        headingRef={headingRef}
      />
      <div className="mt-6">{children}</div>
    </div>
  )
}
