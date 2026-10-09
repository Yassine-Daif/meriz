import { assignmentTypeLabel, formatDueDate } from '../../lib/assignmentsApi'
import type { StudentAssignmentRow } from '../../lib/overviewApi'
import { workStateLabel } from '../../lib/submissionsApi'
import { pendingAssignments } from '../../lib/workAssignments'
import type { ClassroomOpening } from '../ClassesPage'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Notice } from '../ui/Notice'

/** Au-delà, le tableau de bord deviendrait la liste des exercices. */
const SHOWN = 5

interface AttentionToDoProps {
  rows: StudentAssignmentRow[] | null
  error: string | null
  onReload: () => Promise<void>
  onOpenClassroom: (opening: ClassroomOpening) => void
}

/**
 * Ce qui attend l'élève : les devoirs ni rendus ni notés, échéance la
 * plus proche d'abord. Chaque ligne ouvre sa classe sur l'onglet des
 * exercices, là où le travail se fait.
 */
export function AttentionToDo({ rows, error, onReload, onOpenClassroom }: AttentionToDoProps) {
  const pending = rows === null ? null : pendingAssignments(rows)

  return (
    <section aria-labelledby="arendre-titre">
      <h2 id="arendre-titre" className="text-lg font-semibold tracking-tight text-ink">
        À rendre
        {pending !== null && pending.length > 0 && (
          <span className="font-normal text-ink-soft"> ({pending.length})</span>
        )}
      </h2>

      <div className="mt-3">
        {error ? (
          <Notice
            tone="warning"
            announce={false}
            action={
              <Button size="sm" onClick={() => void onReload()}>
                Réessayer
              </Button>
            }
          >
            {error}
          </Notice>
        ) : pending === null ? (
          <p role="status" className="text-sm text-ink-soft">
            Chargement de vos exercices…
          </p>
        ) : pending.length === 0 ? (
          <p className="rounded-card border border-dashed border-line-strong bg-surface p-6 text-center text-sm text-ink-soft">
            Rien à rendre pour l’instant. Les exercices publiés par vos profs arriveront ici.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pending.slice(0, SHOWN).map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() =>
                    onOpenClassroom({
                      id: row.classroom.id,
                      initial: null,
                      message: null,
                      tab: 'exercices',
                      assignmentId: row.id,
                    })
                  }
                  aria-label={`Ouvrir ${row.title}, dans la classe ${row.classroom.name}`}
                  className="flex w-full items-center gap-3 rounded-card border border-line bg-surface p-4 text-left shadow-soft transition duration-150 hover:shadow-lift motion-safe:hover:-translate-y-0.5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{row.title}</span>
                    <span className="block text-xs text-ink-soft">
                      {row.classroom.name} · {formatDueDate(row.dueAt)}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center justify-end gap-1.5">
                    <Badge tone="sky">{assignmentTypeLabel(row.type)}</Badge>
                    <Badge tone="neutral">{workStateLabel(row.state)}</Badge>
                    {row.isOverdue && <Badge tone="apricot">En retard</Badge>}
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
