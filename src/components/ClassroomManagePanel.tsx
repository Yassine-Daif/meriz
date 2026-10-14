import { useId } from 'react'
import { formatJoinCode } from '../lib/classroomsApi'
import type { ClassroomDetail } from '../lib/classroomsApi'
import { Button } from './ui/Button'

interface ClassroomManagePanelProps {
  classroom: ClassroomDetail
  /** Une action est en cours : les boutons attendent. */
  busy: boolean
  onCopyCode: () => void
  onRegenerate: () => void
  onRename: () => void
  onDelete: () => void
}

/**
 * La gestion d'une classe, pour son prof seulement : le code à partager,
 * puis la zone destructive, séparée pour qu'on ne la touche pas par
 * mégarde.
 *
 * Le panneau vit dans son onglet, pas au-dessus des autres : sans cela,
 * il faut le refaire défiler à chaque changement d'onglet. Et quand le
 * code manque, il reste quand même, parce qu'il porte la seule façon de
 * supprimer la classe.
 */
export function ClassroomManagePanel({
  classroom,
  busy,
  onCopyCode,
  onRegenerate,
  onRename,
  onDelete,
}: ClassroomManagePanelProps) {
  const titleId = useId()

  return (
    <section aria-labelledby={titleId} className="rounded-card bg-accent-soft p-5 sm:p-6">
      <h3 id={titleId} className="text-base font-semibold text-ink">
        Gérer la classe
      </h3>
      <p className="mt-1 text-sm text-ink">
        Donnez ce code à vos élèves : ils le saisissent dans « Mes classes ».
      </p>

      {classroom.joinCode === null ? (
        <p className="mt-3 text-sm text-ink-soft">Le code de cette classe n'est pas disponible.</p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {/*
            * Le libellé est visible et hors de la puce : un libellé caché
            * dans le paragraphe se collerait au code pour qui le lit en
            * texte, et le code doit rester lisible seul.
            */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold tracking-wide text-ink uppercase">Code de la classe</span>
            <p className="rounded-control border border-line-strong bg-surface px-4 py-2 font-mono text-2xl font-semibold tracking-widest text-ink">
              {formatJoinCode(classroom.joinCode)}
            </p>
          </div>
          <Button variant="primary" onClick={onCopyCode}>
            Copier le code
          </Button>
          <Button onClick={onRegenerate} disabled={busy}>
            Nouveau code
          </Button>
          <Button onClick={onRename} disabled={busy}>
            Renommer la classe
          </Button>
        </div>
      )}

      <div className="mt-5 border-t border-line pt-4">
        <Button size="sm" variant="danger" onClick={onDelete} disabled={busy}>
          Supprimer la classe
        </Button>
        <p className="mt-1.5 text-xs text-ink">
          Tous les membres en seront retirés. Cette action est définitive.
        </p>
      </div>
    </section>
  )
}
