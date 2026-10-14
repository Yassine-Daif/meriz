import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { ApiClient } from '../../lib/apiClient'
import {
  createAssignment,
  deleteAssignment,
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
import { FormSection } from '../ui/FormSection'
import { Segmented } from '../ui/Segmented'
import { AssignmentImageField } from './AssignmentImageField'
import type { EditAssignmentModel } from './types'

interface AssignmentEditorProps {
  client: ApiClient
  classroomId: string
  /** Devoir existant, ou null pour une création. */
  assignment: Assignment | null
  /** Retour à la liste, avec un message à annoncer. */
  onDone: (message: string | null) => void
  /** Devoir enregistré : la liste et le formulaire suivent. */
  onSaved: (assignment: Assignment) => void
  onEditModel: EditAssignmentModel
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
 * L'énoncé d'un devoir : consigne, image, type, échéance, puis la base
 * et le corrigé qui se construisent dans l'outil MCD. La publication et
 * la libération du corrigé sont deux gestes distincts. L'entête et les
 * sections du devoir sont portées par AssignmentWorkspace.
 */
export function AssignmentEditor({
  client,
  classroomId,
  assignment,
  onDone,
  onSaved,
  onEditModel,
}: AssignmentEditorProps) {
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
  /*
   * Publier remplace le bouton par Dépublier, et libérer le corrigé fait
   * de même : sans ces deux enveloppes, le focus tomberait sur le corps
   * du document à chaque fois. On le rend au bouton qui prend la place.
   */
  const publishAction = useRef<HTMLDivElement>(null)
  const solutionAction = useRef<HTMLDivElement>(null)
  const focusAfter = useRef<'publish' | 'solution' | null>(null)

  useEffect(() => {
    const target = focusAfter.current
    if (target === null) return
    focusAfter.current = null
    const zone = target === 'publish' ? publishAction : solutionAction
    zone.current?.querySelector('button')?.focus()
  }, [assignment?.status, assignment?.solutionReleased])

  const run = async (action: () => Promise<{ ok: true; value: Assignment } | { ok: false; error: { message: string; fieldErrors: Record<string, string[]> } }>, success: string, focus?: 'publish' | 'solution') => {
    if (pending) return
    setPending(true)
    setSaved('')
    setFormError(null)
    const result = await action()
    setPending(false)
    if (result.ok) {
      if (focus !== undefined) focusAfter.current = focus
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
      await run(
        () => unpublishAssignment(client, assignment.id),
        'Devoir dépublié : vos élèves ne le voient plus.',
        'publish',
      )
      return
    }
    await run(
      () => withholdSolution(client, assignment.id),
      'Corrigé retenu : vos élèves ne le voient plus.',
      'solution',
    )
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
    <div className="flex flex-col gap-4">
      <FormSection
        title="Énoncé"
        level="h4"
        description="Ce que vos élèves lisent avant de commencer."
      >
        <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-5">
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

          {/*
            * Le champ passe par FormField : l'aide, l'erreur et l'état
            * invalide s'y relient tout seuls, ce que la version écrite à la
            * main ne faisait pour aucun des trois.
            */}
          <FormField
            label="Date limite"
            type="datetime-local"
            value={dueAt}
            onChange={setDueAt}
            required={false}
            optionalLabel="(facultative)"
            hint="Laissez vide pour un devoir sans échéance."
            error={fieldErrors.dueAt}
          />

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
      </FormSection>

      {assignment ? (
        <>
          <FormSection
            title="Image"
            level="h4"
            description="Un schéma, un énoncé photographié, une capture. JPEG, PNG ou WebP, 2 Mo au plus."
          >
            <AssignmentImageField client={client} assignment={assignment} onChanged={onSaved} />
          </FormSection>

          {/*
            * Chaque modèle dit s'il existe à côté du bouton qui le
            * construit : le verbe du bouton le disait déjà, mais il
            * fallait le lire pour le savoir.
            */}
          <FormSection
            title="Base et corrigé"
            level="h4"
            description="La base est le point de départ donné à vos élèves. Le corrigé reste chez vous tant que vous ne le libérez pas. Les deux se dessinent dans l'outil MCD."
          >
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
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
                <Badge tone={assignment.hasBase ? 'accent' : 'neutral'}>
                  {assignment.hasBase ? 'Base prête' : 'Sans base'}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-2">
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
                <Badge tone={assignment.hasSolution ? 'accent' : 'neutral'}>
                  {assignment.hasSolution ? 'Corrigé prêt' : 'Sans corrigé'}
                </Badge>
              </div>
            </div>
          </FormSection>

          <FormSection title="Diffusion" level="h4">
            {/*
              * Chaque état est collé au bouton qui le change, et le
              * focus revient sur ce bouton quand il prend la place du
              * précédent : sans cela il tombait sur le corps du document.
              */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div ref={publishAction}>
                  {assignment.status === 'published' ? (
                    <Button onClick={() => setPendingAction('unpublish')} disabled={pending}>
                      Dépublier
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      onClick={() =>
                        void run(
                          () => publishAssignment(client, assignment.id),
                          'Devoir publié : vos élèves le voient.',
                          'publish',
                        )
                      }
                      disabled={pending}
                    >
                      Publier
                    </Button>
                  )}
                </div>
                <p className="text-sm text-ink-soft">
                  {assignment.status === 'published'
                    ? 'Ce devoir est visible par les élèves de la classe.'
                    : 'Ce devoir est un brouillon : personne d’autre ne le voit.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div ref={solutionAction}>
                  {assignment.solutionReleased ? (
                    <Button onClick={() => setPendingAction('withhold')} disabled={pending}>
                      Retenir le corrigé
                    </Button>
                  ) : (
                    <Button
                      onClick={() =>
                        void run(
                          () => releaseSolution(client, assignment.id),
                          'Corrigé libéré : vos élèves peuvent le consulter.',
                          'solution',
                        )
                      }
                      disabled={pending || !assignment.hasSolution}
                    >
                      Libérer le corrigé
                    </Button>
                  )}
                </div>
                <p className="text-sm text-ink-soft">
                  {assignment.solutionReleased
                    ? 'Le corrigé est libéré.'
                    : assignment.hasSolution
                      ? 'Le corrigé n’est pas libéré : vos élèves ne le voient pas.'
                      : 'Construisez le corrigé avant de pouvoir le libérer.'}
                </p>
              </div>
            </div>
          </FormSection>

          <div className="border-t border-line pt-4">
            <Button variant="danger" disabled={pending} onClick={() => setPendingAction('delete')}>
              Supprimer le devoir
            </Button>
          </div>
        </>
      ) : (
        <p className="rounded-control bg-surface-soft px-4 py-3 text-sm text-ink-soft">
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
