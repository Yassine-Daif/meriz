import { displayName } from '../lib/authApi'
import type { CollabUser, CollabView, RemotePresence } from '../model/collabProvider'
import { Avatar } from './ui/Avatar'

const VIEW_LABELS: Record<CollabView, string> = {
  dictionnaire: 'dans le Dictionnaire', mcd: 'sur le MCD', mld: 'sur le MLD',
  mpd: 'sur le MPD', sql: 'sur le SQL', code: 'sur le Code',
}

export function ParticipantList({ participants, others }: { participants: CollabUser[]; others: RemotePresence[] }) {
  return <div aria-label="Participants" className="flex flex-wrap items-center gap-3">
    {participants.map((person) => {
      const views = [...new Set(others.filter((other) => other.user.id === person.id).flatMap((other) => other.view ? [VIEW_LABELS[other.view]] : []))]
      return <span key={person.id} className="inline-flex items-center gap-1.5 text-xs">
        <Avatar person={person} size="sm" />
        <span><span className="font-semibold">{displayName(person)}</span>
          {views.length > 0 && <span className="ml-1 text-ink-soft">{' '}{views.join(', ')}</span>}
        </span>
      </span>
    })}
  </div>
}
