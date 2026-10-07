import type { GroupSummary } from '../../lib/groupsApi'
import type { GroupsState } from '../../lib/useGroups'
import { Button } from '../ui/Button'
import { Notice } from '../ui/Notice'
import { GroupCard } from './GroupCard'

interface GroupGridProps {
  state: GroupsState
  onOpen: (group: GroupSummary) => void
  onCopyCode?: (code: string) => void
  emptyText: string
}

/** Groupes en cartes, avec les états chargement, erreur et vide. */
export function GroupGrid({ state, onOpen, onCopyCode, emptyText }: GroupGridProps) {
  const { groups, error, reload } = state
  if (error) {
    return (
      <Notice
        tone="warning"
        announce={false}
        action={
          <Button size="sm" onClick={() => void reload()}>
            Réessayer
          </Button>
        }
      >
        {error}
      </Notice>
    )
  }
  if (groups === null) {
    return (
      <p role="status" className="text-sm text-ink-soft">
        Chargement de vos groupes…
      </p>
    )
  }
  if (groups.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-line-strong bg-surface p-6 text-center text-sm text-ink-soft">
        {emptyText}
      </p>
    )
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {groups.map((group) => (
        <GroupCard key={group.id} group={group} onOpen={() => onOpen(group)} onCopyCode={onCopyCode} />
      ))}
    </ul>
  )
}
