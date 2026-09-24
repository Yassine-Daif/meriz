import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { ApiClient } from '../../lib/apiClient'
import { displayName } from '../../lib/authApi'
import { formatSubmittedAt, getSubmission, gradeSubmission, removeGrade } from '../../lib/submissionsApi'
import type { Submission } from '../../lib/submissionsApi'
import { ConfirmDialog } from '../ConfirmDialog'
import { FormAlert } from '../FormAlert'
import { FormField } from '../FormField'
import { Avatar } from '../ui/Avatar'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Notice } from '../ui/Notice'
import type { OpenReadOnlyModel } from './types'

interface SubmissionReviewProps {
  client: ApiClient
  classroomId: string
  assignmentId: string
  assignmentTitle: string
  submissionId: string
  /** Retour à la liste des rendus, avec un message à annoncer. */
  onBack: (message: string | null) => void
  onOpenReadOnlyModel: OpenReadOnlyModel
}

/**
 * Un rendu d'élève, côté prof : le consulter dans l'outil sans y
 * toucher, puis le noter. La note est libre, le commentaire facultatif.
 * Retirer la note rouvre le rendu : l'élève peut rendre à nouveau.
 */
export function SubmissionReview({
  client,
  classroomId,
  assignmentId,
  assignmentTitle,
  submissionId,
  onBack,
  onOpenReadOnlyModel,
}: SubmissionReviewProps) {
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [grade, setGrade] = useState('')
  const [feedback, setFeedback] = useState('')
  const [gradeError, setGradeError] = useState<string | undefined>()
  const [feedbackError, setFeedbackError] = useState<string | undefined>()
  const [formError, setFormError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState('')
  const [confirmRemove, setConfirmRemove] = useState(false)

  const adopt = useCallback((value: Submission) => {
    setSubmission(value)
    setGrade(value.grade ?? '')
    setFeedback(value.feedback ?? '')
  }, [])

  const load = useCallback(async () => {
    setLoadError(null)
    const result = await getSubmission(client, submissionId)
    if (result.ok) adopt(result.value)
    else setLoadError(result.error.message)
  }, [client, submissionId, adopt])

  useEffect(() => {
    void load()
  }, [load])

  const report = (error: { message: string; fieldErrors: Record<string, string[]> }) => {
    setGradeError(error.fieldErrors.grade?.[0])
    setFeedbackError(error.fieldErrors.feedback?.[0])
    const flagged = error.fieldErrors.grade || error.fieldErrors.feedback
    setFormError(flagged ? 'Vérifiez les champs signalés.' : error.message)
    setAttempt((count) => count + 1)
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setSaved('')
    setFormError(null)
    setGradeError(undefined)
    setFeedbackError(undefined)
    // Les deux champs partent ensemble : noter sans commentaire efface
    // celui d'avant, c'est la règle du serveur.
    const result = await gradeSubmission(client, submissionId, {
      grade: grade.trim(),
      feedback: feedback.trim() === '' ? null : feedback.trim(),
    })
    setPending(false)
    if (result.ok) {
      adopt(result.value)
      setSaved('Note enregistrée. Votre élève la voit, son rendu est verrouillé.')
      return
    }
    report(result.error)
  }

  const withdraw = async () => {
    setConfirmRemove(false)
    if (pending) return
    setPending(true)
    setSaved('')
    setFormError(null)
    const result = await removeGrade(client, submissionId)
    setPending(false)
    if (result.ok) {
      adopt(result.value)
      setSaved('Note retirée. Votre élève peut rendre à nouveau.')
    } else {
      report(result.error)
    }
  }

  const back = (
    <Button variant="ghost" size="sm" onClick={() => onBack(null)} className="-ml-3 mb-3">
      <span aria-hidden="true">←</span>
      Retour aux rendus
    </Button>
  )

  if (loadError) {
    return (
      <div>
        {back}
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
      </div>
    )
  }

  if (!submission) {
    return (
      <div>
        {back}
        <p role="status" className="text-sm text-ink-soft">
          Chargement du rendu…
        </p>
      </div>
    )
  }

  const student = submission.student
  const name = displayName(student)

  return (
    <div>
      {back}

      <div className="flex flex-wrap items-center gap-3">
        <Avatar person={student} size="lg" />
        <div className="min-w-0">
          <h3 className="text-xl font-semibold tracking-tight text-ink">{name}</h3>
          <p className="text-sm text-ink-soft">
            {formatSubmittedAt(submission.submittedAt)}
            {submission.isLate && ', après l’échéance'}.
          </p>
        </div>
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge tone={submission.status === 'graded' ? 'accent' : 'sage'}>
            {submission.status === 'graded' ? 'Noté' : 'Rendu'}
          </Badge>
          {submission.isLate && <Badge tone="apricot">En retard</Badge>}
        </span>
      </div>

      <Card as="section" aria-labelledby="modele-rendu-titre" className="mt-5">
        <h4 id="modele-rendu-titre" className="text-base font-semibold text-ink">
          Le modèle remis
        </h4>
        <p className="mt-1 text-sm text-ink-soft">
          Il s'ouvre en consultation : vous pouvez le parcourir, le vérifier et l'exporter, sans rien y changer.
        </p>
        <div className="mt-3">
          <Button
            variant="primary"
            onClick={() =>
              onOpenReadOnlyModel({
                classroomId,
                assignmentId,
                submissionId: submission.id,
                key: `${submission.id}:rendu`,
                name: `${assignmentTitle} : ${name}`,
                label: `Rendu de ${name}`,
                content: submission.content,
              })
            }
          >
            Consulter le modèle rendu
          </Button>
        </div>
      </Card>

      <form onSubmit={(event) => void submit(event)} className="mt-4 flex flex-col gap-5">
        <FormAlert message={formError} attempt={attempt} />

        <FormField
          label="Note"
          type="text"
          value={grade}
          onChange={setGrade}
          autoComplete="off"
          maxLength={50}
          hint="Libre : « 16/20 », « Acquis », « À revoir »."
          error={gradeError}
        />

        <FormField
          label="Commentaire"
          type="text"
          value={feedback}
          onChange={setFeedback}
          autoComplete="off"
          multiline
          required={false}
          maxLength={2000}
          hint="Facultatif. Ce que votre élève lira avec sa note."
          error={feedbackError}
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" loading={pending} loadingLabel="Enregistrement…">
            {submission.status === 'graded' ? 'Modifier la note' : 'Enregistrer la note'}
          </Button>
          {submission.status === 'graded' && (
            <Button onClick={() => setConfirmRemove(true)} disabled={pending}>
              Retirer la note
            </Button>
          )}
          <p role="status" aria-live="polite" className="text-sm text-ink-soft">
            {saved && (
              <>
                <span aria-hidden="true">✓ </span>
                {saved}
              </>
            )}
          </p>
        </div>
      </form>

      <ConfirmDialog
        open={confirmRemove}
        title="Retirer la note"
        message={`La note et le commentaire seront effacés, et ${name} pourra rendre une nouvelle version.`}
        confirmLabel="Retirer la note"
        onConfirm={() => void withdraw()}
        onCancel={() => setConfirmRemove(false)}
      />
    </div>
  )
}
