import { formatJoinCode } from '../../lib/classroomsApi'
import type { GroupDetail } from '../../lib/groupsApi'
import { Button } from '../ui/Button'
import { GroupInvite } from './GroupInvite'

interface GroupManagePanelProps {
  group: GroupDetail
  /** Une action est en cours : les boutons attendent. */
  busy: boolean
  onCopyCode: () => void
  onRegenerate: () => void
  onRename: () => void
  onDelete: () => void
  onStatus: (text: string) => void
}

/**
 * La gestion d'un groupe, pour son créateur seulement : le code à
 * partager, l'invitation, puis la zone destructive, séparée pour qu'on
 * ne la touche pas par mégarde.
 */
export function GroupManagePanel({
  group,
  busy,
  onCopyCode,
  onRegenerate,
  onRename,
  onDelete,
  onStatus,
}: GroupManagePanelProps) {
  if (group.joinCode === null) {
    return null
  }

  return (
    <section aria-labelledby="gerer-groupe-titre" className="mt-4 rounded-card bg-accent-soft p-4">
      <h3 id="gerer-groupe-titre" className="text-base font-semibold text-ink">
        Gérer le groupe
      </h3>
      <p className="mt-1 text-sm text-ink-soft">
        Partagez ce code pour que d’autres rejoignent le groupe. Un nouveau code annule l’ancien.
      </p>
      <p className="mt-3 font-mono text-2xl font-semibold tracking-widest text-ink">
        {formatJoinCode(group.joinCode)}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="primary" onClick={onCopyCode}>
          Copier le code
        </Button>
        <Button size="sm" onClick={onRegenerate} disabled={busy}>
          Nouveau code
        </Button>
        <Button size="sm" onClick={onRename} disabled={busy}>
          Renommer le groupe
        </Button>
      </div>

      <GroupInvite groupName={group.name} joinCode={group.joinCode} onStatus={onStatus} />

      <div className="mt-4 border-t border-line pt-4">
        <p className="text-sm text-ink-soft">
          Supprimer le groupe efface ses documents partagés. Les documents personnels de chacun restent intacts.
        </p>
        <Button size="sm" variant="danger" onClick={onDelete} disabled={busy} className="mt-2">
          Supprimer le groupe
        </Button>
      </div>
    </section>
  )
}
