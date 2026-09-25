import { useCallback, useEffect, useRef, useState } from 'react'
import type { ApiClient } from '../../lib/apiClient'
import { assignmentTypeLabel, formatDueDate, getAssignment } from '../../lib/assignmentsApi'
import type { Assignment } from '../../lib/assignmentsApi'
import { browserStorage } from '../../lib/browserStorage'
import { listMyAssignments } from '../../lib/overviewApi'
import type { StudentAssignmentRow } from '../../lib/overviewApi'
import { workStateLabel } from '../../lib/submissionsApi'
import type { WorkState } from '../../lib/submissionsApi'
import { createWorkLinks } from '../../lib/workDocuments'
import { useSession } from '../sessionContext'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Notice } from '../ui/Notice'
import { StudentAssignmentView } from './StudentAssignmentView'
import type { OpenReadOnlyModel, OpenWorkDocument } from './types'

interface ClassWorkPanelProps {
  client: ApiClient
  /** Devoir à rouvrir d'emblée (retour de l'outil MCD). */
  openAssignmentId: string | null
  onOpenWorkDocument: OpenWorkDocument
  onOpenReadOnlyModel: OpenReadOnlyModel
}

/** Ce que l'on regarde : la liste, ou un devoir ouvert. */
type View = { kind: 'list' } | { kind: 'open'; classroomId: string; assignment: Assignment }

const STATE_TONE: Record<WorkState, 'neutral' | 'sky' | 'sage' | 'accent'> = {
  todo: 'neutral',
  started: 'sky',
  submitted: 'sage',
  graded: 'accent',
}

/**
 * Tous mes devoirs, toutes classes confondues, triés par échéance. Le
 * serveur regroupe, trie et décide de l'état de chacun : un seul appel,
 * quel que soit le nombre de classes.
 */
export function ClassWorkPanel({
  client,
  openAssignmentId,
  onOpenWorkDocument,
  onOpenReadOnlyModel,
}: ClassWorkPanelProps) {
  const { session } = useSession()
  const userId = session.status === 'signed-in' ? String(session.user.id) : ''
  // Le lien devoir vers document de travail vit dans ce navigateur, sous
  // une clé propre au compte : voir workDocuments.ts.
  const [workLinks] = useState(() => createWorkLinks(browserStorage().storage, userId))

  const [rows, setRows] = useState<StudentAssignmentRow[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [view, setView] = useState<View>({ kind: 'list' })
  const [status, setStatus] = useState<string | null>(null)
  const [opening, setOpening] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoadError(null)
    const result = await listMyAssignments(client)
    if (!result.ok) {
      setLoadError(result.error.message)
      return
    }
    setRows(result.value)
    // Le serveur sait quel document porte mon travail commencé : on pose
    // le lien local quand il manque, pour rouvrir depuis un autre appareil.
    for (const row of result.value) {
      if (row.documentId !== null && workLinks.get(row.id) === null) {
        workLinks.set(row.id, row.documentId)
      }
    }
  }, [client, workLinks])

  useEffect(() => {
    void load()
  }, [load])

  const open = useCallback(
    async (id: string, classroomId: string) => {
      setOpening(id)
      const result = await getAssignment(client, id)
      setOpening(null)
      if (result.ok) {
        setStatus(null)
        setView({ kind: 'open', classroomId, assignment: result.value })
      } else {
        setStatus(result.error.message)
        void load()
      }
    },
    [client, load],
  )

  // Retour de l'outil MCD : le devoir travaillé se rouvre tout seul, une
  // seule fois. Sans ce garde-fou, revenir à la liste le rouvrirait aussitôt.
  const reopened = useRef(false)
  useEffect(() => {
    if (reopened.current || openAssignmentId === null || rows === null) return
    reopened.current = true
    const row = rows.find((candidate) => candidate.id === openAssignmentId)
    if (row) void open(row.id, row.classroom.id)
  }, [openAssignmentId, rows, open])

  if (view.kind === 'open') {
    return (
      <StudentAssignmentView
        client={client}
        classroomId={view.classroomId}
        assignment={view.assignment}
        // L'écran du devoir relit mon rendu lui-même : une note arrivée
        // entre-temps s'affiche quand même.
        initialSubmission={null}
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
    <section aria-labelledby="travail-classe-titre">
      <h2 id="travail-classe-titre" className="text-base font-semibold text-ink">
        Travail de classe
        {rows && rows.length > 0 && <span className="font-normal text-ink-soft"> ({rows.length})</span>}
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Les devoirs de toutes vos classes, du plus proche au plus lointain.
      </p>

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
      ) : rows === null ? (
        <p role="status" className="text-sm text-ink-soft">
          Chargement de vos devoirs…
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-card border border-dashed border-line-strong bg-surface-soft p-6 text-center text-sm text-ink-soft">
          Aucun devoir pour l’instant. Ceux que vos profs publieront apparaîtront ici, avec leur échéance.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => void open(row.id, row.classroom.id)}
                disabled={opening !== null}
                aria-label={`Ouvrir le devoir ${row.title} de la classe ${row.classroom.name}`}
                className="flex w-full flex-col items-start gap-1.5 rounded-card border border-line bg-surface p-4 text-left shadow-soft transition duration-150 hover:shadow-lift disabled:cursor-wait motion-safe:hover:-translate-y-0.5"
              >
                <span className="flex w-full flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink">{row.title}</span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="sky">{assignmentTypeLabel(row.type)}</Badge>
                    <Badge tone={STATE_TONE[row.state]}>
                      {row.state === 'graded' && row.submission?.grade
                        ? `Noté : ${row.submission.grade}`
                        : workStateLabel(row.state)}
                    </Badge>
                    {row.submission?.isLate && <Badge tone="apricot">En retard</Badge>}
                    {row.submission === null && row.isOverdue && <Badge tone="apricot">Échéance passée</Badge>}
                  </span>
                </span>
                <span className="text-xs text-ink-soft">
                  {row.classroom.name} · {formatDueDate(row.dueAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
