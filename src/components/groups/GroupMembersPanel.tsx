import { t } from "../../i18n/runtime"
import { useLanguage } from "../../lib/useLanguage"
import { useId } from 'react'
import { displayName } from '../../lib/authApi'
import { formatDay } from '../../lib/formatDate'
import type { GroupDetail, GroupMember } from '../../lib/groupsApi'
import { MemberCard } from '../MemberCard'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'

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
  useLanguage()
  const admin = group.myRole === 'admin'
  const titleId = useId()

  return (
    <section aria-labelledby={titleId}>
      <h3 id={titleId} className="text-base font-semibold text-ink">
        {t("Membres")}{group.members.length > 0 && <span className="font-normal text-ink-soft"> ({group.members.length})</span>}
      </h3>

      {group.members.length === 0 ? (
        <p className="mt-3 rounded-card border border-dashed border-line-strong bg-surface p-6 text-center text-sm text-ink-soft">
          {t("Personne pour l’instant. Partagez le code du groupe.")}</p>
      ) : (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {group.members.map((member) => (
            <MemberCard
              key={member.id}
              person={member}
              joined={formatDay(member.joinedAt)}
              joinedLabel={t("Dans le groupe depuis le")}
              badge={member.isAdmin ? <Badge tone="accent">{t("Créateur")}</Badge> : undefined}
              action={
                admin && !member.isAdmin ? (
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={busy}
                    aria-label={t("Retirer {0} du groupe", [displayName(member)])}
                    onClick={() => onRemove(member)}
                  >
                    {t("Retirer")}</Button>
                ) : undefined
              }
            />
          ))}
        </ul>
      )}

      {!admin && (
        <div className="mt-6 border-t border-line pt-4">
          <p className="text-sm text-ink-soft">
            {t("Quitter le groupe vous retire l’accès à ses documents partagés, y compris ceux que vous avez créés.")}</p>
          <Button size="sm" variant="danger" onClick={onLeave} disabled={busy} className="mt-2">
            {t("Quitter le groupe")}</Button>
        </div>
      )}
    </section>
  )
}
