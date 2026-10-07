import { displayName } from '../../lib/authApi'
import { formatDate } from '../../lib/formatDate'
import type { GroupDetail, GroupMember } from '../../lib/groupsApi'
import { PersonCard } from '../PersonCard'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

interface GroupMembersPanelProps {
  group: GroupDetail
  busy: boolean
  onRemove: (member: GroupMember) => void
  onLeave: () => void
}

/**
 * Les membres du groupe, avec leur pastille d'initiales. Le créateur
 * peut retirer quelqu'un ; un membre peut partir. Le créateur, lui, ne
 * quitte pas son groupe : il le supprime.
 */
export function GroupMembersPanel({ group, busy, onRemove, onLeave }: GroupMembersPanelProps) {
  const admin = group.myRole === 'admin'

  return (
    <div className="mt-4">
      <h3 className="text-base font-semibold text-ink">
        Membres
        {group.members.length > 0 && <span className="font-normal text-ink-soft"> ({group.members.length})</span>}
      </h3>

      {group.members.length === 0 ? (
        <p className="mt-3 rounded-card border border-dashed border-line-strong bg-surface p-6 text-center text-sm text-ink-soft">
          Personne pour l’instant. Partagez le code du groupe.
        </p>
      ) : (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {group.members.map((member) => {
            const joined = member.joinedAt === null ? '' : formatDate(member.joinedAt)
            return (
              <Card as="li" key={member.id} className="flex flex-wrap items-start justify-between gap-3">
                <PersonCard person={member} extra={joined ? `Dans le groupe depuis le ${joined}` : undefined} />
                <div className="flex flex-col items-end gap-2">
                  {member.isAdmin && <Badge tone="accent">Créateur</Badge>}
                  {admin && !member.isAdmin && (
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={busy}
                      onClick={() => onRemove(member)}
                      aria-label={`Retirer ${displayName(member)} du groupe`}
                    >
                      Retirer
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
        </ul>
      )}

      {!admin && (
        <div className="mt-6 border-t border-line pt-4">
          <p className="text-sm text-ink-soft">
            Quitter le groupe vous retire l’accès à ses documents partagés, y compris ceux que vous avez créés.
          </p>
          <Button size="sm" variant="danger" onClick={onLeave} disabled={busy} className="mt-2">
            Quitter le groupe
          </Button>
        </div>
      )}
    </div>
  )
}
