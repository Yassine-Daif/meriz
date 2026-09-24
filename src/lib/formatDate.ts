const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' })

/** « 15 septembre 2026 à 11:29 », ou un repli si la date est illisible. */
export function formatDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? 'date inconnue' : dateFormat.format(date)
}

/* ------------------------------------------------------------------ */
/* Date relative                                                      */

// La formulation vient d'Intl : « hier », « il y a 3 jours ». On ne
// recompose jamais ces phrases à la main.
const relativeFormat = new Intl.RelativeTimeFormat('fr-FR', { numeric: 'auto' })
const dayFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' })
const dayWithYearFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
/** Au-delà d'une semaine, le relatif ne dit plus rien d'utile. */
export const RELATIVE_LIMIT_MS = 7 * DAY

/**
 * Formulation lisible d'une date passée : « il y a 3 jours », « hier »,
 * puis « le 20 septembre » au-delà d'une semaine, avec l'année si elle
 * n'est pas l'année courante. null quand la date est illisible.
 */
export function formatRelativeDate(iso: string, now: number = Date.now()): string | null {
  const date = new Date(iso)
  const time = date.getTime()
  if (Number.isNaN(time)) {
    return null
  }
  // Une date à venir n'a pas de sens ici : on la traite comme l'instant présent.
  const elapsed = Math.max(0, now - time)

  if (elapsed >= RELATIVE_LIMIT_MS) {
    const sameYear = date.getFullYear() === new Date(now).getFullYear()
    return `le ${(sameYear ? dayFormat : dayWithYearFormat).format(date)}`
  }
  if (elapsed < MINUTE) {
    return relativeFormat.format(0, 'second')
  }
  if (elapsed < HOUR) {
    return relativeFormat.format(-Math.floor(elapsed / MINUTE), 'minute')
  }
  if (elapsed < DAY) {
    return relativeFormat.format(-Math.floor(elapsed / HOUR), 'hour')
  }
  return relativeFormat.format(-Math.floor(elapsed / DAY), 'day')
}
