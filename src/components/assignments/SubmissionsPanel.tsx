import { useCallback, useEffect, useState } from 'react'
import type { ApiClient } from '../../lib/apiClient'
import type { Assignment } from '../../lib/assignmentsApi'
import { formatDueDate } from '../../lib/assignmentsApi'
import { displayName } from '../../lib/authApi'
import { formatSubmittedAt, listAssignmentSubmissions } from '../../lib/submissionsApi'
import type { SubmissionSummary } from '../../lib/submissionsApi'
import { Avatar } from '../ui/Avatar'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Notice } from '../ui/Notice'
import { SubmissionReview } from './SubmissionReview'
import type { OpenReadOnlyModel } from './types'

interface SubmissionsPanelProps {
  client: ApiClient
  assignment: Assignment
  /** Rendu à rouvrir d'emblée (retour de l'outil MCD). */
  openSubmissionId: string | null
  /** Retour au devoir, avec un message à annoncer. */
  onBack: (message: string | null) => void
  onOpenReadOnlyModel: OpenReadOnlyModel
}

type View = { kind: 'list' } | { kind: 'review'; submissionId: string }

/**
 * Rendus d'un devoir, côté prof : qui a rendu, quand, avec quel retard,
 * et où en est la note. Le contenu des modèles n'arrive qu'à l'ouverture
 * d'un rendu : la liste ne le transporte pas.
 */
export function SubmissionsPanel({
  client,
  assignment,
  openSubmissionId,
  onBack,
  onOpenReadOnlyModel,
}: SubmissionsPanelProps) {
  const [submissions, setSubmissions] = useState<SubmissionSummary[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [view, setView] = useState<View>(
    openSubmissionId ? { kind: 'review', submissionId: openSubmissionId } : { kind: 'list' },
  )
  const [status, setStatus] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoadError(null)
    const result = await listAssignmentSubmissions(client, assignment.id)
    if (result.ok) setSubmissions(result.value)
    else setLoadError(result.error.message)
  }, [client, assignment.id])

  useEffect(() => {
    void load()
  }, [load])

  if (view.kind === 'review') {
    return (
      <SubmissionReview
        client={client}
        classroomId={assignment.classroomId}
        assignmentId={assignment.id}
        assignmentTitle={assignment.title}
        submissionId={view.submissionId}
        onBack={(message) => {
          setView({ kind: 'list' })
          setStatus(message)
          void load()
        }}
        onOpenReadOnlyModel={onOpenReadOnlyModel}
      />
    )
  }

  return (
    <section aria-labelledby="rendus-titre">
      <Button variant="ghost" size="sm" onClick={() => onBack(null)} className="-ml-3 mb-3">
        <span aria-hidden="true">←</span>
        Retour au devoir
      </Button>

      <h3 id="rendus-titre" className="text-xl font-semibold tracking-tight text-ink">
        Rendus
        {submissions && submissions.length > 0 && (
          <span className="font-normal text-ink-soft"> ({submissions.length})</span>
        )}
      </h3>
      <p className="mt-1 text-sm text-ink-soft">
        {assignment.title}. {formatDueDate(assignment.dueAt)}.
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
      ) : submissions === null ? (
        <p role="status" className="text-sm text-ink-soft">
          Chargement des rendus…
        </p>
      ) : submissions.length === 0 ? (
        <p className="rounded-card border border-dashed border-line-strong bg-surface-soft p-6 text-center text-sm text-ink-soft">
          Aucun rendu pour l’instant. Ils arriveront ici au fur et à mesure.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {submissions.map((submission) => (
            <li key={submission.id}>
              <button
                type="button"
                onClick={() => setView({ kind: 'review', submissionId: submission.id })}
                aria-label={`Ouvrir le rendu de ${displayName(submission.student)}`}
                className="flex w-full items-center gap-3 rounded-card border border-line bg-surface p-4 text-left shadow-soft transition duration-150 hover:shadow-lift motion-safe:hover:-translate-y-0.5"
              >
                <Avatar person={submission.student} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">
                    {displayName(submission.student)}
                  </span>
                  <span className="block text-xs text-ink-soft">
                    {formatSubmittedAt(submission.submittedAt)}
                  </span>
                </span>
                <span className="flex flex-wrap items-center justify-end gap-1.5">
                  <Badge tone={submission.status === 'graded' ? 'accent' : 'sage'}>
                    {submission.status === 'graded' && submission.grade
                      ? `Noté : ${submission.grade}`
                      : submission.status === 'graded'
                        ? 'Noté'
                        : 'Rendu'}
                  </Badge>
                  {submission.isLate && <Badge tone="apricot">En retard</Badge>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
