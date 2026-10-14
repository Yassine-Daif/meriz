import { useId } from 'react'
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
  onStatus: (text: string, kind?: 'info' | 'error') => void
}

/**
 * La gestion d'un groupe, pour son créateur seulement : le code à
 * partager, l'invitation, puis la zone destructive, séparée pour qu'on
 * ne la touche pas par mégarde.
 *
 * Le code se présente comme celui d'une classe, une puce encadrée sur la
 * même ligne que ses boutons. Et quand il manque, le panneau reste : il
 * le dit, au lieu de disparaître en emportant la seule façon de
 * supprimer le groupe.
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
  const titleId = useId()

  return (
    <section aria-labelledby={titleId} className="rounded-card bg-accent-soft p-5 sm:p-6">
      <h3 id={titleId} className="text-base font-semibold text-ink">
        Gérer le groupe
      </h3>
      <p className="mt-1 text-sm text-ink">
        Partagez ce code pour que d’autres rejoignent le groupe. Un nouveau code annule l’ancien.
      </p>

      {group.joinCode === null ? (
        <p className="mt-3 text-sm text-ink-soft">Le code de ce groupe n'est pas disponible.</p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {/*
              * Le libellé est visible et hors de la puce : un libellé
              * caché dans le paragraphe se collerait au code pour qui le
              * lit en texte, et le code doit rester lisible seul.
              */}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold tracking-wide text-ink uppercase">Code du groupe</span>
              <p className="rounded-control border border-line-strong bg-surface px-4 py-2 font-mono text-2xl font-semibold tracking-widest text-ink">
                {formatJoinCode(group.joinCode)}
              </p>
            </div>
            <Button variant="primary" onClick={onCopyCode}>
              Copier le code
            </Button>
            <Button onClick={onRegenerate} disabled={busy}>
              Nouveau code
            </Button>
            <Button onClick={onRename} disabled={busy}>
              Renommer le groupe
            </Button>
          </div>

          <GroupInvite groupName={group.name} joinCode={group.joinCode} onStatus={onStatus} />
        </>
      )}

      <div className="mt-5 border-t border-line pt-4">
        <Button size="sm" variant="danger" onClick={onDelete} disabled={busy}>
          Supprimer le groupe
        </Button>
        <p className="mt-1.5 text-xs text-ink">
          Supprimer le groupe efface ses documents partagés. Les documents personnels de chacun restent intacts.
        </p>
      </div>
    </section>
  )
}
