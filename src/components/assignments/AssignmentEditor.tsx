import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import type { ApiClient } from '../../lib/apiClient'
import {
  createAssignment,
  deleteAssignment,
  formatDueDate,
  fromLocalInput,
  publishAssignment,
  releaseSolution,
  toLocalInput,
  unpublishAssignment,
  updateAssignment,
  withholdSolution,
} from '../../lib/assignmentsApi'
import type { Assignment, AssignmentType } from '../../lib/assignmentsApi'
import { ConfirmDialog } from '../ConfirmDialog'
import { FormAlert } from '../FormAlert'
import { FormField } from '../FormField'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Segmented } from '../ui/Segmented'
import { AssignmentImageField } from './AssignmentImageField'
import type { EditAssignmentModel } from './types'

interface AssignmentEditorProps {
  client: ApiClient
  classroomId: string
  classroomName: string
  /** Devoir existant, ou null pour une création. */
  assignment: Assignment | null
  /** Retour à la liste, avec un message à annoncer. */
  onDone: (message: string | null) => void
  /** Devoir enregistré : la liste et le formulaire suivent. */
  onSaved: (assignment: Assignment) => void
  onEditModel: EditAssignmentModel
  /** Ouvre les rendus du devoir. Absent tant que le devoir n'existe pas. */
  onShowSubmissions?: () => void
}

type Field = 'title' | 'instructions' | 'dueAt'

const SERVER_FIELD: Record<Field, string> = {
  title: 'title',
  instructions: 'instructions',
  dueAt: 'due_at',
}

const TYPES = [
  { value: 'exercise', label: 'Exercice' },
  { value: 'exam', label: 'Examen' },
] as const

type PendingAction = 'delete' | 'withhold' | 'unpublish'

/**
 * Créer ou modifier un devoir : consigne, image, type, échéance, puis
 * la base et le corrigé qui se construisent dans l'outil MCD. La
 * publication et la libération du corrigé sont deux gestes distincts.
 */
export function AssignmentEditor({
  client,
  classroomId,
  classroomName,
  assignment,
  onDone,
  onSaved,
  onEditModel,
  onShowSubmissions,
}: AssignmentEditorProps) {
  const dueId = useId()
  const [title, setTitle] = useState(assignment?.title ?? '')
  const [instructions, setInstructions] = useState(assignment?.instructions ?? '')
  const [type, setType] = useState<AssignmentType>(assignment?.type ?? 'exercise')
  const [dueAt, setDueAt] = useState(toLocalInput(assignment?.dueAt ?? null))
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState('')
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)

  const report = (error: { message: string; fieldErrors: Record<string, string[]> }) => {
    const next: Partial<Record<Field, string>> = {}
    for (const [field, serverField] of Object.entries(SERVER_FIELD) as [Field, string][]) {
      const message = error.fieldErrors[serverField]?.[0]
      if (message) next[field] = message
    }
    setFieldErrors(next)
    // Un refus qui ne vise aucun champ du formulaire (corrigé absent,
    // image refusée) garde le message du serveur, plus parlant.
    const formFields = new Set(Object.values(SERVER_FIELD))
    const elsewhere = Object.entries(error.fieldErrors)
      .filter(([field]) => !formFields.has(field))
      .flatMap(([, messages]) => messages)
    setFormError(
      Object.keys(next).length > 0 ? 'Vérifiez les champs signalés.' : (elsewhere[0] ?? error.message),
    )
    setAttempt((count) => count + 1)
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setSaved('')
    setFormError(null)
    setFieldErrors({})
    const draft = {
      title: title.trim(),
      instructions: instructions.trim(),
      type,
      dueAt: fromLocalInput(dueAt),
    }
    const result = assignment
      ? await updateAssignment(client, assignment.id, draft)
      : await createAssignment(client, classroomId, draft)
    setPending(false)
    if (result.ok) {
      setSaved(assignment ? 'Devoir enregistré.' : 'Devoir créé, en brouillon.')
      onSaved(result.value)
      return
    }
    report(result.error)
  }

  /** Action sur un devoir existant : publication, corrigé, suppression. */
  const run = async (action: () => Promise<{ ok: true; value: Assignment } | { ok: false; error: { message: string; fieldErrors: Record<string, string[]> } }>, success: string) => {
    if (pending) return
    setPending(true)
    setSaved('')
    setFormError(null)
    const result = await action()
    setPending(false)
    if (result.ok) {
      setSaved(success)
      onSaved(result.value)
    } else {
      report(result.error)
    }
  }

  const confirmAction = async () => {
    const action = pendingAction
    setPendingAction(null)
    if (!action || !assignment) return
    if (action === 'delete') {
      setPending(true)
      const result = await deleteAssignment(client, assignment.id)
      setPending(false)
      if (result.ok) onDone(`Devoir « ${assignment.title} » supprimé.`)
      else report(result.error)
      return
    }
    if (action === 'unpublish') {
      await run(() => unpublishAssignment(client, assignment.id), 'Devoir dépublié : vos élèves ne le voient plus.')
      return
    }
    await run(() => withholdSolution(client, assignment.id), 'Corrigé retenu : vos élèves ne le voient plus.')
  }

  const dialogText: Record<PendingAction, { title: string; message: string; confirm: string }> = {
    delete: {
      title: 'Supprimer le devoir',
      message: `Supprimer « ${assignment?.title ?? ''} » ? Les rendus des élèves seront supprimés aussi. Cette action est définitive.`,
      confirm: 'Supprimer le devoir',
    },
    unpublish: {
      title: 'Dépublier le devoir',
      message: 'Le devoir redevient un brouillon : vos élèves ne le verront plus, leurs rendus sont conservés.',
      confirm: 'Dépublier',
    },
    withhold: {
      title: 'Retenir le corrigé',
      message: 'Le corrigé redevient privé : vos élèves ne le verront plus.',
      confirm: 'Retenir le corrigé',
    },
  }

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => onDone(null)} className="-ml-3 mb-3">
        <span aria-hidden="true">←</span>
        Retour aux devoirs
      </Button>

      <h3 className="text-xl font-semibold tracking-tight text-ink">
        {assignment ? 'Modifier le devoir' : 'Créer un devoir'}
      </h3>
      <p className="mt-1 text-sm text-ink-soft">Classe {classroomName}.</p>

      {assignment && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone={assignment.status === 'published' ? 'sage' : 'neutral'}>
            {assignment.status === 'published' ? 'Publié' : 'Brouillon'}
          </Badge>
          <Badge tone={assignment.hasBase ? 'accent' : 'neutral'}>
            {assignment.hasBase ? 'Base prête' : 'Sans base'}
          </Badge>
          <Badge tone={assignment.hasSolution ? (assignment.solutionReleased ? 'apricot' : 'neutral') : 'neutral'}>
            {assignment.hasSolution
              ? assignment.solutionReleased
                ? 'Corrigé libéré'
                : 'Corrigé retenu'
              : 'Sans corrigé'}
          </Badge>
          <span className="text-sm text-ink-soft">{formatDueDate(assignment.dueAt)}</span>
        </div>
      )}

      <form onSubmit={(event) => void submit(event)} className="mt-5 flex flex-col gap-5">
        <FormAlert message={formError} attempt={attempt} />

        <FormField
          label="Titre"
          type="text"
          value={title}
          onChange={setTitle}
          autoComplete="off"
          maxLength={200}
          hint="Ce que vos élèves verront en premier."
          error={fieldErrors.title}
        />

        <FormField
          label="Consigne"
          type="text"
          value={instructions}
          onChange={setInstructions}
          autoComplete="off"
          multiline
          maxLength={20000}
          hint="La mise en situation : le domaine à modéliser, les règles de gestion, ce que vous attendez."
          error={fieldErrors.instructions}
        />

        <Segmented<AssignmentType> legend="Type" options={TYPES} value={type} onChange={setType} />

        <div>
          <label htmlFor={dueId} className="block text-sm font-medium text-ink">
            Date limite <span className="ml-1 font-normal text-ink-soft">(facultative)</span>
          </label>
          <p className="mt-0.5 text-xs text-ink-soft">Laissez vide pour un devoir sans échéance.</p>
          <input
            id={dueId}
            type="datetime-local"
            value={dueAt}
            onChange={(event) => setDueAt(event.target.value)}
            className="mt-1.5 rounded-control border border-line-strong bg-surface px-3.5 py-2.5 text-sm text-ink"
          />
          {fieldErrors.dueAt && (
            <p className="mt-1.5 text-xs font-medium text-danger">
              <span aria-hidden="true">✕ </span>
              {fieldErrors.dueAt}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" loading={pending} loadingLabel="Enregistrement…">
            {assignment ? 'Enregistrer' : 'Créer le devoir'}
          </Button>
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

      {assignment ? (
        <>
          <section aria-labelledby="image-titre" className="mt-8 rounded-card border border-line bg-surface p-5 shadow-soft">
            <h4 id="image-titre" className="text-base font-semibold text-ink">
              Image
            </h4>
            <p className="mt-1 text-xs text-ink-soft">
              Un schéma, un énoncé photographié, une capture. JPEG, PNG ou WebP, 2 Mo au plus.
            </p>
            <div className="mt-3">
              <AssignmentImageField client={client} assignment={assignment} onChanged={onSaved} />
            </div>
          </section>

          <section aria-labelledby="modeles-titre" className="mt-4 rounded-card bg-accent-soft p-5">
            <h4 id="modeles-titre" className="text-base font-semibold text-ink">
              Base et corrigé
            </h4>
            <p className="mt-1 text-sm text-ink">
              La base est le point de départ donné à vos élèves. Le corrigé reste chez vous tant que vous ne le
              libérez pas. Les deux se dessinent dans l'outil MCD.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="primary"
                onClick={() =>
                  onEditModel(
                    { id: assignment.id, classroomId: assignment.classroomId, title: assignment.title },
                    'base',
                    assignment.baseContent,
                  )
                }
              >
                {assignment.hasBase ? 'Modifier la base' : 'Construire la base'}
              </Button>
              <Button
                onClick={() =>
                  onEditModel(
                    { id: assignment.id, classroomId: assignment.classroomId, title: assignment.title },
                    'solution',
                    assignment.solutionContent,
                  )
                }
              >
                {assignment.hasSolution ? 'Modifier le corrigé' : 'Construire le corrigé'}
              </Button>
            </div>
          </section>

          <section aria-labelledby="diffusion-titre" className="mt-4 rounded-card border border-line bg-surface p-5 shadow-soft">
            <h4 id="diffusion-titre" className="text-base font-semibold text-ink">
              Diffusion
            </h4>
            <p className="mt-1 text-sm text-ink-soft">
              {assignment.status === 'published'
                ? 'Ce devoir est visible par les élèves de la classe.'
                : 'Ce devoir est un brouillon : personne d’autre ne le voit.'}{' '}
              {assignment.solutionReleased
                ? 'Le corrigé est libéré.'
                : 'Le corrigé n’est pas libéré : vos élèves ne le voient pas.'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {assignment.status === 'published' ? (
                <Button onClick={() => setPendingAction('unpublish')} disabled={pending}>
                  Dépublier
                </Button>
              ) : (
                <Button
                  variant="primary"
                  onClick={() => void run(() => publishAssignment(client, assignment.id), 'Devoir publié : vos élèves le voient.')}
                  disabled={pending}
                >
                  Publier
                </Button>
              )}
              {assignment.solutionReleased ? (
                <Button onClick={() => setPendingAction('withhold')} disabled={pending}>
                  Retenir le corrigé
                </Button>
              ) : (
                <Button
                  onClick={() => void run(() => releaseSolution(client, assignment.id), 'Corrigé libéré : vos élèves peuvent le consulter.')}
                  disabled={pending}
                >
                  Libérer le corrigé
                </Button>
              )}
            </div>
          </section>

          {onShowSubmissions && (
            <section aria-labelledby="suivi-titre" className="mt-4 rounded-card border border-line bg-surface p-5 shadow-soft">
              <h4 id="suivi-titre" className="text-base font-semibold text-ink">
                Suivi
              </h4>
              <p className="mt-1 text-sm text-ink-soft">
                {assignment.status === 'published'
                  ? 'Les travaux remis par vos élèves, à consulter et à noter.'
                  : 'Publiez le devoir pour que vos élèves puissent rendre leur travail.'}
              </p>
              <div className="mt-3">
                <Button variant="primary" onClick={onShowSubmissions} disabled={pending}>
                  Voir les rendus
                </Button>
              </div>
            </section>
          )}

          <div className="mt-6 border-t border-line pt-4">
            <button
              type="button"
              onClick={() => setPendingAction('delete')}
              disabled={pending}
              className="inline-flex min-h-10 items-center rounded-control border border-danger bg-surface px-4 py-2 text-sm font-medium text-danger transition-colors duration-150 hover:bg-danger-soft hover:text-danger"
            >
              Supprimer le devoir
            </button>
          </div>
        </>
      ) : (
        <p className="mt-6 rounded-control bg-surface-soft px-4 py-3 text-sm text-ink-soft">
          Créez le devoir pour ajouter une image, construire sa base et son corrigé, puis le publier.
        </p>
      )}

      <ConfirmDialog
        open={pendingAction !== null}
        title={pendingAction ? dialogText[pendingAction].title : ''}
        message={pendingAction ? dialogText[pendingAction].message : ''}
        confirmLabel={pendingAction ? dialogText[pendingAction].confirm : ''}
        onConfirm={() => void confirmAction()}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  )
}
