import { displayName } from '../../lib/authApi'
import { initials } from '../../lib/initials'

export type AvatarSize = 'sm' | 'md' | 'lg'

/** Personne telle qu'on la dessine : son nom et ses deux couleurs. */
export interface AvatarPerson {
  firstName: string | null
  name: string
  avatarBg: string
  avatarFg: string
}

interface AvatarProps {
  person: AvatarPerson
  size?: AvatarSize
  /**
   * Vrai quand la pastille est seule : elle porte alors le nom de la
   * personne. Faux par défaut, car le nom est presque toujours écrit
   * juste à côté et serait répété.
   */
  labelled?: boolean
  className?: string
}

/** Tailles en rem : elles suivent le réglage de taille de l'interface. */
const SIZES: Record<AvatarSize, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-16 w-16 text-xl',
}

/**
 * Pastille ronde aux initiales d'une personne, sur ses couleurs de
 * profil. C'est le seul endroit où une couleur est posée en style en
 * ligne : elle vient des données, pas du thème.
 */
export function Avatar({ person, size = 'md', labelled = false, className }: AvatarProps) {
  const naming = labelled
    ? { role: 'img' as const, 'aria-label': displayName(person) || 'Personne sans nom' }
    : { 'aria-hidden': true as const }

  return (
    <span
      {...naming}
      style={{ backgroundColor: person.avatarBg, color: person.avatarFg }}
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold tracking-wide ring-1 ring-line ${SIZES[size]} ${className ?? ''}`}
    >
      {initials(person)}
    </span>
  )
}
