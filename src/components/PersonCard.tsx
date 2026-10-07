import { displayName } from '../lib/authApi'
import type { PublicProfile } from '../lib/classroomsApi'
import { Avatar } from './ui/Avatar'

/**
 * Une personne telle qu'autrui la voit. Pour que les cartes gardent la
 * même taille, seul l'essentiel reste visible : pastille, nom, date
 * d'arrivée et contact partagé. La présentation, plus longue, se déplie
 * à la demande.
 */
export function PersonCard({ person, extra }: { person: PublicProfile; extra?: string }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <Avatar person={person} size="md" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{displayName(person)}</p>
        {extra && <p className="mt-0.5 text-xs text-ink-soft">{extra}</p>}
        {person.contact && (
          <p className="mt-0.5 text-xs text-ink-soft">
            Contact : <span className="font-mono">{person.contact}</span>
          </p>
        )}
        {person.bio && (
          <details className="group mt-1.5">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-control text-xs font-medium text-accent-ink [&::-webkit-details-marker]:hidden">
              <span
                aria-hidden="true"
                className="transition-transform duration-150 group-open:rotate-90 motion-reduce:transition-none"
              >
                ▸
              </span>
              Présentation
            </summary>
            <p className="mt-1 text-sm leading-6 text-ink-soft">{person.bio}</p>
          </details>
        )}
      </div>
    </div>
  )
}
