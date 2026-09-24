import { useCallback, useEffect, useState } from 'react'
import type { ApiClient } from '../../lib/apiClient'
import { assignmentTypeLabel, copyAssignmentBase, formatDueDate } from '../../lib/assignmentsApi'
import type { Assignment } from '../../lib/assignmentsApi'
import { createCloudDocument, getCloudDocument } from '../../lib/documentsApi'
import { emptyEditorState } from '../../model/document'
import { DEFAULT_MPD_SETTINGS } from '../../model/mpd'
import { serializeModel } from '../../lib/persistence'
import { formatSubmittedAt, getMySubmission, submitWork } from '../../lib/submissionsApi'
import type { Submission } from '../../lib/submissionsApi'
import type { WorkLinks } from '../../lib/workDocuments'
import { ConfirmDialog } from '../ConfirmDialog'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Notice } from '../ui/Notice'
import { AssignmentImagePreview } from './AssignmentImagePreview'
import type { OpenReadOnlyModel, OpenWorkDocument } from './types'

interface StudentAssignmentViewProps {
  client: ApiClient
  classroomId: string
  assignment: Assignment
  /** Mon rendu déjà connu, s'il y en a un. */
  initialSubmission: Submission | null
  workLinks: WorkLinks
  onBack: (message: string | null) => void
  onOpenWorkDocument: OpenWorkDocument
  onOpenReadOnlyModel: OpenReadOnlyModel
}

/**
 * Un devoir vu par l'élève : la consigne, son travail, et son rendu.
 *
 * Le travail est un document personnel ordinaire, enregistré tout seul.
 * Il n'arrive chez le prof qu'au clic sur Rendre. Une fois le rendu noté,
 * le serveur le verrouille : l'écran le dit et n'offre plus de rendre.
 */
export function StudentAssignmentView({
  client,
  classroomId,
  assignment,
  initialSubmission,
  workLinks,
  onBack,
  onOpenWorkDocument,
  onOpenReadOnlyModel,
}: StudentAssignmentViewProps) {
  const [submission, setSubmission] = useState<Submission | null>(initialSubmission)
  const [workId, setWorkId] = useState<string | null>(() => workLinks.get(assignment.id))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [confirmSubmit, setConfirmSubmit] = useState(false)

  const locked = submission?.status === 'graded'

  // Relecture du rendu à l'ouverture : la note a pu arriver entre-temps.
  // Un rendu absent est un état normal, pas une erreur à afficher.
  useEffect(() => {
    let active = true
    void getMySubmission(client, assignment.id).then((result) => {
      if (!active) return
      if (result.ok) {
        setSubmission(result.value)
      } else if (result.error.kind === 'not_found') {
        setSubmission(null)
      }
    })
    return () => {
      active = false
    }
  }, [client, assignment.id])

  /** Retient le document de travail, puis ouvre l'outil dessus. */
  const linkAndOpen = useCallback(
    async (documentId: string) => {
      workLinks.set(assignment.id, documentId)
      setWorkId(documentId)
      const failure = await onOpenWorkDocument(classroomId, assignment.id, documentId)
      if (failure) {
        // Document disparu : le lien ne vaut plus rien, on repart de zéro.
        workLinks.clear(assignment.id)
        setWorkId(null)
        setError(failure.message)
      }
    },
    [workLinks, assignment.id, classroomId, onOpenWorkDocument],
  )

  const startWork = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    // Une base à copier, sinon une page blanche : dans les deux cas, un
    // document personnel que l'élève garde après le cours.
    const created = assignment.hasBase
      ? await copyAssignmentBase(client, assignment.id)
      : await createCloudDocument(client, {
          name: assignment.title,
          content: serializeModel(emptyEditorState(), DEFAULT_MPD_SETTINGS, assignment.title),
        })
    setBusy(false)
    if (!created.ok) {
      setError(created.error.fieldErrors.base_content?.[0] ?? created.error.message)
      return
    }
    await linkAndOpen(created.value.id)
  }

  /** Autre appareil, cache vidé : on repart du travail déjà rendu. */
  const resumeFromSubmission = async () => {
    if (busy || !submission) return
    setBusy(true)
    setError(null)
    const created = await createCloudDocument(client, {
      name: assignment.title,
      content: submission.content,
    })
    setBusy(false)
    if (!created.ok) {
      setError(created.error.message)
      return
    }
    await linkAndOpen(created.value.id)
  }

  const openWork = async () => {
    if (busy || workId === null) return
    setBusy(true)
    setError(null)
    const failure = await onOpenWorkDocument(classroomId, assignment.id, workId)
    setBusy(false)
    if (failure) {
      workLinks.clear(assignment.id)
      setWorkId(null)
      setError(`${failure.message} Vous pouvez repartir de la consigne.`)
    }
  }

  const submit = async () => {
    setConfirmSubmit(false)
    if (busy || workId === null) return
    setBusy(true)
    setError(null)
    setStatus(null)
    // Le contenu est relu auprès du serveur : jamais une version tronquée.
    const document = await getCloudDocument(client, workId)
    if (!document.ok) {
      setBusy(false)
      setError(document.error.message)
      return
    }
    const sent = await submitWork(client, assignment.id, document.value.content)
    setBusy(false)
    if (!sent.ok) {
      setError(sent.error.fieldErrors.content?.[0] ?? sent.error.message)
      return
    }
    setSubmission(sent.value)
    setStatus(sent.value.isLate ? 'Travail rendu, après l’échéance.' : 'Travail rendu.')
  }

  const overdue = assignment.dueAt !== null && new Date(assignment.dueAt).getTime() < Date.now()

  return (
    <section aria-labelledby="devoir-eleve-titre" className="flex flex-col gap-4">
      <div>
        <Button variant="ghost" size="sm" onClick={() => onBack(null)}>
          <span aria-hidden="true">←</span>
          Retour aux exercices
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="devoir-eleve-titre" className="text-lg font-semibold tracking-tight text-ink">
          {assignment.title}
        </h3>
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge tone="sky">{assignmentTypeLabel(assignment.type)}</Badge>
          {submission && (
            <Badge tone={locked ? 'accent' : 'sage'}>{locked ? 'Noté' : 'Rendu'}</Badge>
          )}
          {submission?.isLate && <Badge tone="apricot">Rendu en retard</Badge>}
        </span>
      </div>

      <p className="text-sm text-ink-soft">{formatDueDate(assignment.dueAt)}</p>

      <p role="status" aria-live="polite" className="min-h-5 text-sm text-ink-soft">
        {status}
      </p>

      {error && (
        <Notice tone="error" title="Action impossible">
          {error}
        </Notice>
      )}

      {locked && submission && (
        <Notice tone="success" title={`Note : ${submission.grade ?? ''}`}>
          {submission.feedback ? (
            <span className="whitespace-pre-wrap">{submission.feedback}</span>
          ) : (
            'Votre prof n’a pas laissé de commentaire.'
          )}
          <span className="mt-1 block text-ink-soft">
            Votre rendu est verrouillé tant que la note reste en place.
          </span>
        </Notice>
      )}

      <Card as="section" aria-labelledby="consigne-titre">
        <h4 id="consigne-titre" className="text-base font-semibold text-ink">
          Consigne
        </h4>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">{assignment.instructions}</p>
        {assignment.hasImage && (
          <div className="mt-3">
            <AssignmentImagePreview client={client} assignmentId={assignment.id} title={assignment.title} />
          </div>
        )}
      </Card>

      <Card as="section" aria-labelledby="travail-titre">
        <h4 id="travail-titre" className="text-base font-semibold text-ink">
          Mon travail
        </h4>
        <p className="mt-1 text-sm text-ink-soft">
          {workId !== null
            ? 'Votre travail est un document personnel : il s’enregistre tout seul, et n’est remis à votre prof qu’au clic sur Rendre.'
            : submission
              ? 'Votre travail n’est pas ouvert sur cet appareil. Vous pouvez repartir de ce que vous avez déjà rendu.'
              : assignment.hasBase
                ? 'Votre prof a préparé une base. Vous en obtiendrez une copie à vous, modifiable.'
                : 'Vous partirez d’une page blanche, dans l’outil de modélisation.'}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {workId !== null ? (
            <Button variant="primary" onClick={() => void openWork()} disabled={busy}>
              Ouvrir mon travail
            </Button>
          ) : submission ? (
            <Button variant="primary" onClick={() => void resumeFromSubmission()} disabled={busy}>
              Reprendre mon travail
            </Button>
          ) : (
            <Button variant="primary" onClick={() => void startWork()} disabled={busy}>
              Commencer
            </Button>
          )}

          {!locked && (
            <Button
              variant="secondary"
              onClick={() => setConfirmSubmit(true)}
              disabled={busy || workId === null}
            >
              {submission ? 'Rendre à nouveau' : 'Rendre'}
            </Button>
          )}
          <p role="status" aria-live="polite" className="text-sm text-ink-soft empty:hidden">
            {busy ? 'Un instant…' : ''}
          </p>
        </div>

        {!locked && workId === null && (
          <p className="mt-2 text-sm text-ink-soft">Commencez votre travail avant de le rendre.</p>
        )}

        {submission && (
          <p className="mt-3 text-sm text-ink-soft">
            {formatSubmittedAt(submission.submittedAt)}
            {submission.isLate && ', après l’échéance'}.
          </p>
        )}
      </Card>

      {assignment.solutionContent !== null && (
        <Card as="section" aria-labelledby="corrige-titre">
          <h4 id="corrige-titre" className="text-base font-semibold text-ink">
            Corrigé
          </h4>
          <p className="mt-1 text-sm text-ink-soft">
            Votre prof a libéré le corrigé. Il s’ouvre en consultation, sans rien modifier.
          </p>
          <div className="mt-3">
            <Button
              variant="secondary"
              onClick={() =>
                onOpenReadOnlyModel({
                  classroomId,
                  assignmentId: assignment.id,
                  submissionId: null,
                  key: `${assignment.id}:corrige`,
                  name: assignment.title,
                  label: 'Corrigé',
                  content: assignment.solutionContent ?? '',
                })
              }
            >
              Voir le corrigé
            </Button>
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={confirmSubmit}
        title={submission ? 'Rendre une nouvelle version' : 'Rendre mon travail'}
        message={
          `Votre prof verra le modèle tel qu'il est enregistré maintenant.` +
          (submission ? ' Cette version remplacera la précédente.' : '') +
          (overdue ? ' L’échéance est passée : le rendu sera marqué en retard.' : '')
        }
        confirmLabel={submission ? 'Rendre à nouveau' : 'Rendre'}
        onConfirm={() => void submit()}
        onCancel={() => setConfirmSubmit(false)}
      />
    </section>
  )
}
