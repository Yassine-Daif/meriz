import { formatDate, formatRelativeDate, RELATIVE_LIMIT_MS } from '../../lib/formatDate'

interface UpdatedAtProps {
  /** Date de dernière modification, telle que le serveur la renvoie. */
  iso: string | null
  className?: string
}

/**
 * Date de dernière mise à jour, en formulation lisible. Le texte visible
 * reste court ; la date complète suit pour les lecteurs d'écran, et en
 * infobulle à la souris. Rien ne s'affiche si la date est inexploitable.
 */
export function UpdatedAt({ iso, className }: UpdatedAtProps) {
  if (iso === null) {
    return null
  }
  const relative = formatRelativeDate(iso)
  if (relative === null) {
    return null
  }
  const exact = formatDate(iso)
  // Passé une semaine, la formulation est déjà une date : la répéter pour
  // les lecteurs d'écran donnerait « le 16 août, le 16 août ».
  const spellOut = Date.now() - new Date(iso).getTime() < RELATIVE_LIMIT_MS

  return (
    <time dateTime={iso} title={`Mis à jour le ${exact}`} className={className}>
      Mis à jour {relative}
      {spellOut && <span className="sr-only">, le {exact}</span>}
    </time>
  )
}
