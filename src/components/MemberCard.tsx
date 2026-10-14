import type { ReactNode } from 'react'
import { displayName } from '../lib/authApi'
import type { PublicProfile } from '../lib/classroomsApi'
import { Avatar } from './ui/Avatar'
import { Card } from './ui/Card'

interface MemberCardProps {
  person: PublicProfile
  /** Date d'arrivée déjà mise en forme, ou null : la place reste tenue. */
  joined: string | null
  /** Ce que dit la date : « Arrivé le », « Dans le groupe depuis le ». */
  joinedLabel?: string
  /** Pastille de rôle, posée en haut à droite. */
  badge?: ReactNode
  /** Bouton d'action sur ce membre, posé sous la pastille. */
  action?: ReactNode
}

/**
 * Un membre dans une liste : avatar, nom, puis deux emplacements de
 * hauteur tenue, la date d'arrivée et le contact.
 *
 * Ces deux emplacements gardent leur place même vides. C'est tout
 * l'intérêt de la carte : un profil rempli et un profil vide donnent la
 * même hauteur, donc la liste ne se déforme plus d'une carte à l'autre.
 * La présentation, elle, reste repliée et vient en dernier, pour que son
 * ouverture pousse vers le bas sans décaler ce qui précède.
 */
export function MemberCard({ person, joined, joinedLabel = 'Arrivé le', badge, action }: MemberCardProps) {
  return (
    <Card as="li" className="flex h-full flex-col">
      <div className="flex items-start gap-3">
        <Avatar person={person} size="md" />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{displayName(person)}</p>

          {/* Les deux lignes tiennent leur place, pleines ou vides. */}
          <p className="mt-0.5 min-h-4 text-xs text-ink-soft">
            {joined === null ? '' : `${joinedLabel} ${joined}`}
          </p>
          <p className="mt-0.5 min-h-4 text-xs text-ink-soft">
            {person.contact === null || person.contact.trim() === '' ? (
              ''
            ) : (
              <>
                Contact : <span className="font-mono">{person.contact}</span>
              </>
            )}
          </p>
        </div>

        {(badge || action) && (
          <div className="flex shrink-0 flex-col items-end gap-2">
            {badge}
            {action}
          </div>
        )}
      </div>

      {person.bio && (
        <details className="group mt-3">
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
    </Card>
  )
}
