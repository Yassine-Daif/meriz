import { t } from "../i18n/runtime"
import { useLanguage } from "../lib/useLanguage"
import { displayName } from '../lib/authApi'
import type { CollabUser, CollabView, RemotePresence } from '../model/collabProvider'
import { Avatar } from './ui/Avatar'

const VIEW_LABELS: Record<CollabView, string> = {
  get dictionnaire() { return t("dans le Dictionnaire") }, get mcd() { return t("sur le MCD") }, get mld() { return t("sur le MLD") },
  get mpd() { return t("sur le MPD") }, get sql() { return t("sur le SQL") }, get code() { return t("sur le Code") },
}

export function ParticipantList({ participants, others }: { participants: CollabUser[]; others: RemotePresence[] }) {
  useLanguage()
  return <div aria-label={t("Participants")} className="flex items-center gap-3">
    {participants.map((person) => {
      const views = [...new Set(others.filter((other) => other.user.id === person.id).flatMap((other) => other.view ? [VIEW_LABELS[other.view]] : []))]
      return <span key={person.id} className="inline-flex max-w-64 shrink-0 items-center gap-1.5 text-xs">
        <Avatar person={person} size="sm" />
        <span className="min-w-0"><span className="block truncate font-semibold">{displayName(person)}</span>
          {views.length > 0 && <span className="block truncate text-ink-soft">{' '}{views.join(', ')}</span>}
        </span>
      </span>
    })}
  </div>
}
