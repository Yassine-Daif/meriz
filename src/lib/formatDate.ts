const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' })

/** « 15 septembre 2026 à 11:29 », ou un repli si la date est illisible. */
export function formatDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? 'date inconnue' : dateFormat.format(date)
}
