import { assignmentTypeLabel } from '../../lib/assignmentsApi'
import { displayName } from '../../lib/authApi'
import { formatRelativeDate } from '../../lib/formatDate'
import type { ToGradeRow } from '../../lib/overviewApi'
import type { ToGradeState } from '../../lib/useToGrade'
import type { CorrectionOpening } from '../CorrectionsPage'
import { Avatar } from '../ui/Avatar'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Notice } from '../ui/Notice'

/** Au-delà, le tableau de bord deviendrait la page À corriger. */
const SHOWN = 5

interface AttentionToGradeProps {
  state: ToGradeState
  onOpen: (opening: CorrectionOpening) => void
  onShowAll: () => void
}

function submittedLabel(row: ToGradeRow): string {
  if (row.submittedAt === null) return 'Date de remise inconnue'
  return `Rendu ${formatRelativeDate(row.submittedAt) ?? 'à une date inconnue'}`
}

/**
 * Ce qui attend le prof : les rendus les plus anciens d'abord, cinq au
 * plus. Le reste vit sur la page À corriger, où la liste se pagine.
 * L'erreur reste dans cette section : le reste du tableau de bord
 * s'affiche quand même.
 */
export function AttentionToGrade({ state, onOpen, onShowAll }: AttentionToGradeProps) {
  const { rows, total, error, reload } = state

  return (
    <section aria-labelledby="attention-titre">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="attention-titre" className="text-lg font-semibold tracking-tight text-ink">
          Demande votre attention
          {total > 0 && <span className="font-normal text-ink-soft"> ({total})</span>}
        </h2>
        {total > SHOWN && (
          <Button variant="ghost" size="sm" onClick={onShowAll}>
            Voir tous les rendus à corriger
          </Button>
        )}
      </div>

      <div className="mt-3">
        {error ? (
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
        ) : rows === null ? (
          <p role="status" className="text-sm text-ink-soft">
            Chargement des rendus à corriger…
          </p>
        ) : rows.length === 0 ? (
          <p className="rounded-card border border-dashed border-line-strong bg-surface p-6 text-center text-sm text-ink-soft">
            Rien à corriger pour l’instant. Les travaux remis par vos élèves arriveront ici.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.slice(0, SHOWN).map((row) => (
              <li key={row.submissionId}>
                <button
                  type="button"
                  onClick={() =>
                    onOpen({
                      submissionId: row.submissionId,
                      classroomId: row.classroom.id,
                      assignmentId: row.assignment.id,
                    })
                  }
                  aria-label={`Corriger le rendu de ${displayName(row.student)} pour ${row.assignment.title}`}
                  className="flex w-full items-center gap-3 rounded-card border border-line bg-surface p-4 text-left shadow-soft transition duration-150 hover:shadow-lift motion-safe:hover:-translate-y-0.5"
                >
                  <Avatar person={row.student} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{displayName(row.student)}</span>
                    <span className="block text-sm text-ink">{row.assignment.title}</span>
                    <span className="block text-xs text-ink-soft">
                      {row.classroom.name} · {submittedLabel(row)}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center justify-end gap-1.5">
                    <Badge tone="sky">{assignmentTypeLabel(row.assignment.type)}</Badge>
                    {row.isLate && <Badge tone="apricot">En retard</Badge>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
