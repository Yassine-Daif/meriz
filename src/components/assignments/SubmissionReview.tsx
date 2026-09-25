import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { ApiClient } from '../../lib/apiClient'
import { displayName } from '../../lib/authApi'
import { parseModelFile } from '../../lib/persistence'
import { compareMcd } from '../../model/compare'
import { ComparisonPanel } from './ComparisonPanel'
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
  /** Corrigé du devoir, quand le prof en a construit un. */
  solutionContent: string | null
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
  solutionContent,
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

  /**
   * Comparaison au corrigé, calculée ici sans rien demander au serveur :
   * le prof a déjà les deux contenus en main. Une lecture impossible d'un
   * côté ou de l'autre donne simplement « pas de comparaison ».
   */
  const comparison = useMemo(() => {
    if (solutionContent === null || submission === null) {
      return null
    }
    const corrige = parseModelFile(solutionContent)
    const rendu = parseModelFile(submission.content)
    if (!corrige.ok || !rendu.ok) {
      return null
    }
    return compareMcd(rendu.state.mcd, corrige.state.mcd)
  }, [solutionContent, submission])

  const adopt = useCallback((value: Submission) => {
    setSubmission(value)
    setGrade(value.grade ?? '')
    setFeedback(value.feedback ?? '')
  }, [])

  // Numéro du dernier chargement demandé. Une réponse dépassée n'écrase
  // plus le formulaire : sans ce garde-fou, une seconde lecture qui
  // revient en retard effacerait la note que le prof vient de saisir.
  const loadTicket = useRef(0)

  const load = useCallback(async () => {
    const ticket = loadTicket.current + 1
    loadTicket.current = ticket
    setLoadError(null)
    const result = await getSubmission(client, submissionId)
    if (ticket !== loadTicket.current) {
      return
    }
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

      {comparison ? (
        <ComparisonPanel
          comparison={comparison}
          onUseGrade={setGrade}
          onAddToFeedback={(text) =>
            // On ajoute sans écraser : le prof garde ce qu'il avait écrit.
            setFeedback((current) => (current.trim() === '' ? text : `${current.trimEnd()}\n\n${text}`))
          }
        />
      ) : (
        <p className="mt-4 text-sm text-ink-soft">
          {solutionContent === null
            ? 'Pas de comparaison : ce devoir n’a pas de corrigé. Construisez-en un pour obtenir cette aide.'
            : 'Pas de comparaison : le corrigé ou le rendu n’a pas pu être relu.'}
        </p>
      )}

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
