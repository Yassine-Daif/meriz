import { useEffect, useState } from 'react'

/** On ne propose le retour qu'au-delà d'un écran de défilement. */
const SEUIL = 600

interface BackToTopProps {
  /** Identifiant de la zone qui défile. */
  targetId: string
}

/**
 * Revenir en haut d'une page longue, sans remonter à la main.
 *
 * Le bouton n'existe que si la page défile vraiment, donc il ne gêne
 * aucune page courte. Le défilement est doux, sauf si le système demande
 * moins de mouvement : la règle CSS du dépôt ne couvre pas scrollTo, qui
 * est une interface de script, donc on lit la préférence ici.
 *
 * Après le retour, le focus va au titre de la page. Sans cela, la
 * tabulation repartirait du bas du document, là où ce bouton se trouve.
 */
export function BackToTop({ targetId }: BackToTopProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const zone = document.getElementById(targetId)
    if (zone === null) return

    const suivre = () => setVisible(zone.scrollTop > SEUIL)
    suivre()
    zone.addEventListener('scroll', suivre, { passive: true })
    return () => zone.removeEventListener('scroll', suivre)
  }, [targetId])

  if (!visible) {
    return null
  }

  const remonter = () => {
    const zone = document.getElementById(targetId)
    if (zone === null) return
    const calme = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
    zone.scrollTo({ top: 0, behavior: calme ? 'auto' : 'smooth' })
    // Le titre de la page porte déjà tabIndex={-1} : c'est la cible prévue.
    zone.querySelector<HTMLElement>('h1[tabindex="-1"]')?.focus()
  }

  return (
    <button
      type="button"
      onClick={remonter}
      className="fixed right-5 bottom-5 z-40 inline-flex min-h-11 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-ink shadow-lift transition-colors duration-150 hover:bg-surface-soft hover:text-ink"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="shrink-0"
      >
        <path d="M8 13V3" />
        <path d="m4 7 4-4 4 4" />
      </svg>
      Revenir en haut
    </button>
  )
}
