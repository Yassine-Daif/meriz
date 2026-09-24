import { useCallback, useEffect, useState } from 'react'
import type { ApiClient } from '../../lib/apiClient'
import { assignmentTypeLabel, formatDueDate, getAssignment, listClassroomAssignments } from '../../lib/assignmentsApi'
import type { Assignment, AssignmentSummary } from '../../lib/assignmentsApi'
import { browserStorage } from '../../lib/browserStorage'
import { getMySubmission, workState, workStateLabel } from '../../lib/submissionsApi'
import type { Submission, WorkState } from '../../lib/submissionsApi'
import { createWorkLinks } from '../../lib/workDocuments'
import { useSession } from '../sessionContext'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Notice } from '../ui/Notice'
import { StudentAssignmentView } from './StudentAssignmentView'
import type { OpenReadOnlyModel, OpenWorkDocument } from './types'

interface StudentAssignmentsPanelProps {
  client: ApiClient
  classroomId: string
  /** Devoir à rouvrir d'emblée (retour de l'outil MCD). */
  openAssignmentId: string | null
  onOpenWorkDocument: OpenWorkDocument
  onOpenReadOnlyModel: OpenReadOnlyModel
}

/** Ce que l'on regarde : la liste, ou un devoir ouvert. */
type View = { kind: 'list' } | { kind: 'open'; assignment: Assignment; submission: Submission | null }

const STATE_TONE: Record<WorkState, 'neutral' | 'sky' | 'sage' | 'accent'> = {
  todo: 'neutral',
  started: 'sky',
  submitted: 'sage',
  graded: 'accent',
}

/**
 * Exercices d'une classe, côté élève : les devoirs publiés par le prof,
 * avec l'avancement de chacun. Le serveur ne renvoie que les devoirs
 * publiés à un élève, et l'état d'un rendu se demande devoir par devoir.
 */
export function StudentAssignmentsPanel({
  client,
  classroomId,
  openAssignmentId,
  onOpenWorkDocument,
  onOpenReadOnlyModel,
}: StudentAssignmentsPanelProps) {
  const { session } = useSession()
  const userId = session.status === 'signed-in' ? String(session.user.id) : ''
  // Le lien devoir vers document de travail vit dans ce navigateur, sous
  // une clé propre au compte : voir workDocuments.ts.
  const [workLinks] = useState(() => createWorkLinks(browserStorage().storage, userId))

  const [assignments, setAssignments] = useState<AssignmentSummary[] | null>(null)
  const [submissions, setSubmissions] = useState<Record<string, Submission>>({})
  const [loadError, setLoadError] = useState<string | null>(null)
  const [view, setView] = useState<View>({ kind: 'list' })
  const [status, setStatus] = useState<string | null>(null)
  const [opening, setOpening] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoadError(null)
    const result = await listClassroomAssignments(client, classroomId)
    if (!result.ok) {
      setLoadError(result.error.message)
      return
    }
    setAssignments(result.value)
    // Un « introuvable » veut dire « rien rendu » : c'est un état, pas
    // une erreur. Les états se demandent en parallèle, un par devoir.
    const found = await Promise.all(
      result.value.map(async (assignment) => {
        const mine = await getMySubmission(client, assignment.id)
        return mine.ok ? ([assignment.id, mine.value] as const) : null
      }),
    )
    setSubmissions(Object.fromEntries(found.filter((entry) => entry !== null)))
  }, [client, classroomId])

  useEffect(() => {
    void load()
  }, [load])

  const open = useCallback(
    async (id: string) => {
      setOpening(id)
      const result = await getAssignment(client, id)
      setOpening(null)
      if (result.ok) {
        setStatus(null)
        // Le rendu n'est pas passé d'ici : l'écran du devoir le relit
        // lui-même, pour afficher une note arrivée entre-temps.
        setView({ kind: 'open', assignment: result.value, submission: null })
      } else {
        setStatus(result.error.message)
        void load()
      }
    },
    [client, load],
  )

  // Retour de l'outil MCD : le devoir travaillé se rouvre tout seul.
  useEffect(() => {
    if (openAssignmentId) {
      void open(openAssignmentId)
    }
  }, [openAssignmentId, open])

  if (view.kind === 'open') {
    return (
      <StudentAssignmentView
        client={client}
        classroomId={classroomId}
        assignment={view.assignment}
        initialSubmission={view.submission}
        workLinks={workLinks}
        onBack={(message) => {
          setView({ kind: 'list' })
          setStatus(message)
          void load()
        }}
        onOpenWorkDocument={onOpenWorkDocument}
        onOpenReadOnlyModel={onOpenReadOnlyModel}
      />
    )
  }

  return (
    <section aria-labelledby="exercices-titre">
      <h3 id="exercices-titre" className="text-base font-semibold text-ink">
        Exercices de la classe
        {assignments && assignments.length > 0 && (
          <span className="font-normal text-ink-soft"> ({assignments.length})</span>
        )}
      </h3>

      <p role="status" aria-live="polite" className="mt-2 min-h-5 text-sm text-ink-soft">
        {status}
      </p>

      {loadError ? (
        <Notice
          tone="warning"
          announce={false}
          action={
            <Button size="sm" onClick={() => void load()}>
              Réessayer
            </Button>
          }
        >
          {loadError}
        </Notice>
      ) : assignments === null ? (
        <p role="status" className="text-sm text-ink-soft">
          Chargement des exercices…
        </p>
      ) : assignments.length === 0 ? (
        <p className="rounded-card border border-dashed border-line-strong bg-surface-soft p-6 text-center text-sm text-ink-soft">
          Aucun exercice pour l’instant. Ceux que votre prof publiera apparaîtront ici, avec leur échéance.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {assignments.map((assignment) => {
            const state = workState(submissions[assignment.id] ?? null, workLinks.get(assignment.id) !== null)
            const grade = submissions[assignment.id]?.grade
            return (
              <li key={assignment.id}>
                <button
                  type="button"
                  onClick={() => void open(assignment.id)}
                  disabled={opening !== null}
                  aria-label={`Ouvrir le devoir ${assignment.title}`}
                  className="flex w-full flex-col items-start gap-1.5 rounded-card border border-line bg-surface p-4 text-left shadow-soft transition duration-150 hover:shadow-lift disabled:cursor-wait motion-safe:hover:-translate-y-0.5"
                >
                  <span className="flex w-full flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-ink">{assignment.title}</span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Badge tone="sky">{assignmentTypeLabel(assignment.type)}</Badge>
                      <Badge tone={STATE_TONE[state]}>
                        {state === 'graded' && grade ? `Noté : ${grade}` : workStateLabel(state)}
                      </Badge>
                      {submissions[assignment.id]?.isLate && <Badge tone="apricot">En retard</Badge>}
                    </span>
                  </span>
                  <span className="text-xs text-ink-soft">{formatDueDate(assignment.dueAt)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
