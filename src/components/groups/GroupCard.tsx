import { counted } from "../../lib/plural"
import { t } from "../../i18n/runtime"
import { useLanguage } from "../../lib/useLanguage"
import { displayName } from '../../lib/authApi'
import { formatJoinCode } from '../../lib/classroomsApi'
import type { GroupSummary } from '../../lib/groupsApi'
import { Badge } from '../ui/Badge'

interface GroupCardProps {
  group: GroupSummary
  onOpen: () => void
  /** Copie du code (créateur seulement, le code n'arrive qu'à lui). */
  onCopyCode?: (code: string) => void
}

/**
 * Carte d'un groupe : nom, qui l'a créé, effectifs, et mon rôle écrit en
 * toutes lettres. Pour le créateur, le code et un bouton pour le copier.
 */
export function GroupCard({ group, onOpen, onCopyCode }: GroupCardProps) {
  useLanguage()
  const admin = group.myRole === 'admin'
  const counts = [
    group.membersCount !== null && counted(group.membersCount, 'membre', 'membres'),
    group.documentsCount !== null && counted(group.documentsCount, 'document', 'documents'),
  ].filter((part): part is string => part !== false)

  return (
    <li className="flex flex-col rounded-card border border-line bg-surface shadow-soft transition duration-150 hover:shadow-lift">
      <button
        type="button"
        onClick={onOpen}
        className="flex flex-1 flex-col items-start gap-2 rounded-card p-4 text-left"
      >
        <span className="flex w-full items-start justify-between gap-2">
          <span className="text-base font-semibold text-ink">{group.name}</span>
          <Badge tone={admin ? 'accent' : 'sky'}>{admin ? t("Créateur") : t("Membre")}</Badge>
        </span>
        <span className="text-sm text-ink-soft">
          {group.creator ? t("Créé par {0}", [displayName(group.creator)]) : t("Créateur inconnu")}
          {counts.length > 0 && ` · ${counts.join(' · ')}`}
        </span>
      </button>
      {admin && group.joinCode && onCopyCode && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-2.5">
          <span className="text-xs text-ink-soft">{t("Code")}</span>
          <span className="font-mono text-sm font-semibold tracking-widest text-ink">
            {formatJoinCode(group.joinCode)}
          </span>
          <button
            type="button"
            onClick={() => onCopyCode(group.joinCode ?? '')}
            aria-label={t("Copier le code du groupe {0}", [group.name])}
            className="ml-auto rounded-control px-2.5 py-1 text-xs font-medium text-accent-ink transition-colors duration-150 hover:bg-accent-soft hover:text-accent-ink"
          >
            {t("Copier")}</button>
        </div>
      )}
    </li>
  )
}
