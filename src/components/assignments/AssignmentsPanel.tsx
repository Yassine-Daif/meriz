import { useCallback, useEffect, useState } from 'react'
import type { ApiClient } from '../../lib/apiClient'
import { assignmentTypeLabel, formatDueDate, getAssignment, listClassroomAssignments } from '../../lib/assignmentsApi'
import type { Assignment, AssignmentSummary } from '../../lib/assignmentsApi'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Notice } from '../ui/Notice'
import { AssignmentWorkspace } from './AssignmentWorkspace'
import type { AssignmentTab } from './AssignmentWorkspace'
import type { EditAssignmentModel, OpenReadOnlyModel } from './types'

interface AssignmentsPanelProps {
  client: ApiClient
  classroomId: string
  classroomName: string
  /** Devoir à rouvrir d'emblée (retour de l'outil MCD). */
  openAssignmentId: string | null
  /** Rendu à rouvrir dans ce devoir (retour d'une consultation). */
  openSubmissionId: string | null
  onEditAssignmentModel: EditAssignmentModel
  onOpenReadOnlyModel: OpenReadOnlyModel
}

/** Ce que l'on regarde : la liste, un devoir ouvert, ou un nouveau. */
type View =
  | { kind: 'list' }
  | { kind: 'edit'; assignment: Assignment; tab: AssignmentTab }
  | { kind: 'create' }

/** État du devoir, écrit en toutes lettres et non porté par la seule couleur. */
function StateBadges({ assignment }: { assignment: AssignmentSummary }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Badge tone={assignment.status === 'published' ? 'sage' : 'neutral'}>
        {assignment.status === 'published' ? 'Publié' : 'Brouillon'}
      </Badge>
      <Badge tone="sky">{assignmentTypeLabel(assignment.type)}</Badge>
      {assignment.hasBase && <Badge tone="accent">Base prête</Badge>}
      {assignment.hasSolution && (
        <Badge tone={assignment.solutionReleased ? 'apricot' : 'neutral'}>
          {assignment.solutionReleased ? 'Corrigé libéré' : 'Corrigé retenu'}
        </Badge>
      )}
    </span>
  )
}

/**
 * Devoirs d'une classe, côté prof : la liste, la création, et l'éditeur
 * d'un devoir. Tout passe par le serveur, rien n'est gardé ici.
 */
export function AssignmentsPanel({
  client,
  classroomId,
  classroomName,
  openAssignmentId,
  openSubmissionId,
  onEditAssignmentModel,
  onOpenReadOnlyModel,
}: AssignmentsPanelProps) {
  const [assignments, setAssignments] = useState<AssignmentSummary[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [view, setView] = useState<View>({ kind: 'list' })
  const [status, setStatus] = useState<string | null>(null)
  const [opening, setOpening] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoadError(null)
    const result = await listClassroomAssignments(client, classroomId)
    if (result.ok) {
      setAssignments(result.value)
    } else {
      setLoadError(result.error.message)
    }
  }, [client, classroomId])

  useEffect(() => {
    void load()
  }, [load])

  const open = useCallback(
    async (id: string, showSubmissions = false) => {
      setOpening(id)
      const result = await getAssignment(client, id)
      setOpening(null)
      if (result.ok) {
        setStatus(null)
        setView({ kind: 'edit', assignment: result.value, tab: showSubmissions ? 'rendus' : 'enonce' })
      } else {
        setStatus(result.error.message)
        void load()
      }
    },
    [client, load],
  )

  // Retour de l'outil MCD : le devoir travaillé se rouvre tout seul, sur
  // ses rendus quand on revenait d'un rendu consulté.
  useEffect(() => {
    if (openAssignmentId) {
      void open(openAssignmentId, openSubmissionId !== null)
    }
  }, [openAssignmentId, openSubmissionId, open])

  const backToList = (message: string | null) => {
    setView({ kind: 'list' })
    setStatus(message)
    void load()
  }

  if (view.kind !== 'list') {
    const opened = view.kind === 'edit' ? view.assignment : null
    return (
      <AssignmentWorkspace
        // Une clé par devoir : l'onglet de départ est relu à chaque ouverture.
        key={opened?.id ?? 'creation'}
        client={client}
        classroomId={classroomId}
        classroomName={classroomName}
        assignment={opened}
        initialTab={view.kind === 'edit' ? view.tab : 'enonce'}
        openSubmissionId={openSubmissionId}
        onDone={backToList}
        onSaved={(assignment) => {
          setView({ kind: 'edit', assignment, tab: 'enonce' })
          void load()
        }}
        onEditModel={onEditAssignmentModel}
        onOpenReadOnlyModel={onOpenReadOnlyModel}
      />
    )
  }

  return (
    <section aria-labelledby="devoirs-titre">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="devoirs-titre" className="text-base font-semibold text-ink">
          Devoirs de la classe
          {assignments && assignments.length > 0 && (
            <span className="font-normal text-ink-soft"> ({assignments.length})</span>
          )}
        </h3>
        <Button variant="primary" onClick={() => setView({ kind: 'create' })}>
          <span aria-hidden="true">+</span>
          Créer un devoir
        </Button>
      </div>

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
          Chargement des devoirs…
        </p>
      ) : assignments.length === 0 ? (
        <p className="rounded-card border border-dashed border-line-strong bg-surface-soft p-6 text-center text-sm text-ink-soft">
          Aucun devoir pour l’instant : créez le premier, il restera en brouillon tant que vous ne l’aurez pas publié.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {assignments.map((assignment) => (
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
                  <StateBadges assignment={assignment} />
                </span>
                <span className="text-xs text-ink-soft">{formatDueDate(assignment.dueAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
