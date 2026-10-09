import { buttonClass } from './buttonClass'

interface BackButtonProps {
  /** Texte visible, qui sert aussi de nom accessible. */
  label?: string
  onClick: () => void
  /**
   * Finition encadrée, pour un retour posé dans une barre déjà chargée :
   * il doit s'en détacher. À plat partout ailleurs.
   */
  framed?: boolean
  className?: string
  title?: string
  'aria-label'?: string
}

/**
 * Le retour de l'application, un seul composant pour tous les écrans.
 *
 * La flèche est un tracé, pas le caractère « ← » : un glyphe dépend de
 * la police chargée, un tracé tient toujours. Elle est décorative, donc
 * masquée aux lecteurs d'écran, et c'est le libellé qui nomme le bouton.
 */
export function BackButton({
  label = 'Retour',
  onClick,
  framed = false,
  className,
  title,
  'aria-label': ariaLabel,
}: BackButtonProps) {
  const base = buttonClass({ variant: framed ? 'secondary' : 'ghost', size: 'sm' })
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      className={`${base} min-h-9 ${className ?? ''}`}
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
        <path d="M13 8H3" />
        <path d="M7 4 3 8l4 4" />
      </svg>
      {label}
    </button>
  )
}
