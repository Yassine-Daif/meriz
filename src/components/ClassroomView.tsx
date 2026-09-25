import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { ApiClient, ApiError } from '../lib/apiClient'
import { displayName } from '../lib/authApi'
import {
  deleteClassroom,
  formatJoinCode,
  getClassroom,
  leaveClassroom,
  regenerateJoinCode,
  removeMember,
  renameClassroom,
} from '../lib/classroomsApi'
import type { ClassroomDetail, ClassroomMember, PublicProfile } from '../lib/classroomsApi'
import { ConfirmDialog } from './ConfirmDialog'
import { Avatar } from './ui/Avatar'
import { AssignmentsPanel } from './assignments/AssignmentsPanel'
import { StudentAssignmentsPanel } from './assignments/StudentAssignmentsPanel'
import type { EditAssignmentModel, OpenReadOnlyModel, OpenWorkDocument } from './assignments/types'
import { LessonsPanel } from './lessons/LessonsPanel'
import { StudentLessonsPanel } from './lessons/StudentLessonsPanel'
import { TabPanel, Tabs } from './ui/Tabs'
import { FormField } from './FormField'
import { primaryButtonClass, secondaryButtonClass, smallButtonClass } from './buttonStyles'

interface ClassroomViewProps {
  client: ApiClient
  classroomId: string
  /** Devoir à rouvrir dans l'onglet Exercices (retour de l'outil MCD). */
  openAssignmentId?: string | null
  /** Rendu à rouvrir dans ce devoir (retour d'une consultation). */
  openSubmissionId?: string | null
  /** Onglet d'arrivée, quand on vient d'un raccourci de l'accueil. */
  openTab?: ClassroomTab | null
  /** Ouvre l'outil MCD sur la base ou le corrigé d'un devoir. */
  onEditAssignmentModel: EditAssignmentModel
  /** Ouvre l'outil MCD sur le travail d'un élève pour un devoir. */
  onOpenWorkDocument: OpenWorkDocument
  /** Ouvre l'outil MCD en consultation (rendu d'un élève, corrigé libéré). */
  onOpenReadOnlyModel: OpenReadOnlyModel
  /** Vue déjà connue (création, adhésion) : affichée sans attendre. */
  initial: ClassroomDetail | null
  /** La classe n'est plus accessible (quittée, supprimée) : retour à la liste. */
  onGone: (message: string) => void
  /** Message à annoncer à l'arrivée (classe rejointe ou créée). */
  initialStatus?: string | null
}

/** Sections de l'espace d'une classe. */
export type ClassroomTab = 'eleves' | 'exercices' | 'cours'

type PendingAction =
  | { kind: 'leave' }
  | { kind: 'delete' }
  | { kind: 'regenerate' }
  | { kind: 'remove'; member: ClassroomMember }

const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' })

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : dateFormat.format(date)
}

/**
 * Une personne telle qu'autrui la voit. Pour que les cartes gardent la
 * même taille, seul l'essentiel reste visible : pastille, nom, date
 * d'arrivée et contact partagé. La présentation, plus longue, se déplie
 * à la demande.
 */
function PersonCard({ person, extra }: { person: PublicProfile; extra?: string }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <Avatar person={person} size="md" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{displayName(person)}</p>
        {extra && <p className="mt-0.5 text-xs text-ink-soft">{extra}</p>}
        {person.contact && (
          <p className="mt-0.5 text-xs text-ink-soft">
            Contact : <span className="font-mono">{person.contact}</span>
          </p>
        )}
        {person.bio && (
          <details className="group mt-1.5">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-control text-xs font-medium text-accent-ink [&::-webkit-details-marker]:hidden">
              <span
                aria-hidden="true"
                className="transition-transform duration-150 group-open:rotate-90 motion-reduce:transition-none"
              >
                ▸
              </span>
              Présentation
            </summary>
            <p className="mt-1 text-sm leading-6 text-ink-soft">{person.bio}</p>
          </details>
        )}
      </div>
    </div>
  )
}

/**
 * Une classe. Pour tous : nom, prof et camarades, sans email. Pour le
 * prof de la classe : code à partager, dates d'arrivée, et la gestion
 * (renommer, nouveau code, retirer, supprimer), chaque action
 * destructive étant confirmée.
 */
export function ClassroomView({
  client,
  classroomId,
  initial,
  onGone,
  initialStatus = null,
  openAssignmentId = null,
  openSubmissionId = null,
  openTab = null,
  onEditAssignmentModel,
  onOpenWorkDocument,
  onOpenReadOnlyModel,
}: ClassroomViewProps) {
  const [classroom, setClassroom] = useState<ClassroomDetail | null>(initial)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [status, setStatus] = useState<{ kind: 'info' | 'error'; text: string } | null>(null)

  // Posé après le montage : une zone live n'annonce que ce qui change.
  useEffect(() => {
    if (initialStatus) setStatus({ kind: 'info', text: initialStatus })
  }, [initialStatus])
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [busy, setBusy] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState('')
  const [renameError, setRenameError] = useState<string | undefined>()
  // Onglet d'arrivée : celui demandé par un raccourci de l'accueil, sinon
  // Exercices au retour de l'outil MCD sur un devoir, sinon les élèves.
  const [tab, setTab] = useState<ClassroomTab>(openTab ?? (openAssignmentId ? 'exercices' : 'eleves'))
  const idBase = useId()

  // Le rappel du parent peut changer à chaque rendu : on garde le dernier
  // sans relancer le chargement.
  const onGoneRef = useRef(onGone)
  useEffect(() => {
    onGoneRef.current = onGone
  }, [onGone])

  const load = useCallback(async () => {
    setLoadError(null)
    const result = await getClassroom(client, classroomId)
    if (result.ok) {
      setClassroom(result.value)
    } else if (result.error.kind === 'not_found') {
      onGoneRef.current("Cette classe n'est plus accessible.")
    } else {
      setLoadError(result.error.message)
    }
  }, [client, classroomId])

  useEffect(() => {
    void load()
  }, [load])

  const report = (error: ApiError | null, success: string) => {
    setStatus(error ? { kind: 'error', text: error.message } : { kind: 'info', text: success })
  }

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(formatJoinCode(code))
      setStatus({ kind: 'info', text: `Code ${formatJoinCode(code)} copié dans le presse-papiers.` })
    } catch {
      setStatus({ kind: 'error', text: 'Copie impossible dans ce navigateur : recopiez le code affiché.' })
    }
  }

  const confirm = async () => {
    const action = pendingAction
    setPendingAction(null)
    if (!action || !classroom || busy) return
    setBusy(true)
    if (action.kind === 'leave') {
      const result = await leaveClassroom(client, classroom.id)
      setBusy(false)
      if (result.ok) onGone(`Vous avez quitté la classe « ${classroom.name} ».`)
      else report(result.error, '')
    } else if (action.kind === 'delete') {
      const result = await deleteClassroom(client, classroom.id)
      setBusy(false)
      if (result.ok) onGone(`Classe « ${classroom.name} » supprimée.`)
      else report(result.error, '')
    } else if (action.kind === 'regenerate') {
      const result = await regenerateJoinCode(client, classroom.id)
      setBusy(false)
      if (result.ok) setClassroom(result.value)
      report(
        result.ok ? null : result.error,
        `Nouveau code : ${formatJoinCode(result.ok ? (result.value.joinCode ?? '') : '')}. L'ancien ne fonctionne plus.`,
      )
    } else {
      const result = await removeMember(client, classroom.id, action.member.id)
      setBusy(false)
      if (result.ok) {
        setClassroom({
          ...classroom,
          members: classroom.members.filter((member) => member.id !== action.member.id),
          membersCount: classroom.membersCount === null ? null : classroom.membersCount - 1,
        })
      }
      report(result.ok ? null : result.error, `${displayName(action.member)} a été retiré de la classe.`)
    }
  }

  const startRenaming = () => {
    setNewName(classroom?.name ?? '')
    setRenameError(undefined)
    setRenaming(true)
  }

  const submitRename = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!classroom || busy) return
    setBusy(true)
    setRenameError(undefined)
    const result = await renameClassroom(client, classroom.id, newName.trim())
    setBusy(false)
    if (result.ok) {
      setClassroom(result.value)
      setRenaming(false)
      setStatus({ kind: 'info', text: `Classe renommée en « ${result.value.name} ».` })
    } else {
      setRenameError(result.error.fieldErrors.name?.[0] ?? result.error.message)
    }
  }

  if (!classroom) {
    return (
      <div className="rounded-card border border-line bg-surface p-6 text-sm text-ink shadow-soft">
        {loadError ? (
          <p className="flex flex-wrap items-center gap-2">
            <span aria-hidden="true" className="text-warning">⚠</span>
            {loadError}
            <button type="button" onClick={() => void load()} className={smallButtonClass}>
              Réessayer
            </button>
          </p>
        ) : (
          <p role="status" className="text-ink-soft">Chargement de la classe…</p>
        )}
      </div>
    )
  }

  const isTeacher = classroom.myRole === 'teacher'
  const dialogText: Record<PendingAction['kind'], { title: string; message: string; confirm: string }> = {
    leave: {
      title: 'Quitter la classe',
      message: `Quitter « ${classroom.name} » ? Pour revenir, il vous faudra de nouveau son code.`,
      confirm: 'Quitter la classe',
    },
    delete: {
      title: 'Supprimer la classe',
      message: `Supprimer « ${classroom.name} » ? Tous les membres en seront retirés. Cette action est définitive.`,
      confirm: 'Supprimer la classe',
    },
    regenerate: {
      title: 'Nouveau code',
      message: "Créer un nouveau code ? L'ancien code ne fonctionnera plus. Les membres actuels restent dans la classe.",
      confirm: 'Créer un nouveau code',
    },
    remove: {
      title: 'Retirer un membre',
      message:
        pendingAction?.kind === 'remove'
          ? `Retirer ${displayName(pendingAction.member)} de la classe ? La personne pourra revenir avec le code.`
          : '',
      confirm: 'Retirer',
    },
  }

  const tabs = [
    { value: 'eleves' as const, label: isTeacher ? 'Membres' : 'Élèves', count: classroom.members.length },
    { value: 'exercices' as const, label: 'Exercices' },
    { value: 'cours' as const, label: 'Cours' },
  ]
  const dangerButtonClass =
    'inline-flex min-h-10 items-center rounded-control border border-danger bg-surface px-4 py-2 text-sm font-medium text-danger transition-colors duration-150 hover:bg-danger-soft hover:text-danger'

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {renaming ? (
          <form onSubmit={(event) => void submitRename(event)} className="flex min-w-0 flex-1 flex-wrap items-end gap-2">
            <div className="min-w-60 flex-1">
              <FormField
                label="Nom de la classe"
                type="text"
                value={newName}
                onChange={setNewName}
                autoComplete="off"
                maxLength={100}
                error={renameError}
              />
            </div>
            <button type="submit" disabled={busy} className={primaryButtonClass}>
              Renommer
            </button>
            <button type="button" onClick={() => setRenaming(false)} className={secondaryButtonClass}>
              Annuler
            </button>
          </form>
        ) : (
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold tracking-tight text-ink">{classroom.name}</h2>
            <p className="text-sm text-ink-soft">
              {isTeacher ? 'Vous êtes le prof de cette classe.' : 'Vous êtes élève dans cette classe.'}
            </p>
          </div>
        )}
        {isTeacher && !renaming && (
          <button type="button" onClick={startRenaming} className={smallButtonClass}>
            Renommer
          </button>
        )}
      </div>

      <p role="status" aria-live="polite" className="min-h-5 text-sm">
        {status && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-ink ${
              status.kind === 'error' ? 'bg-warning-soft' : 'bg-sage-soft'
            }`}
          >
            <span aria-hidden="true" className={status.kind === 'error' ? 'text-warning' : 'text-sage'}>
              {status.kind === 'error' ? '⚠' : '✓'}
            </span>
            {status.text}
          </span>
        )}
      </p>

      {isTeacher && (
        <section aria-labelledby="gestion-titre" className="rounded-card bg-accent-soft p-5 sm:p-6">
          <h3 id="gestion-titre" className="text-base font-semibold text-ink">
            Gérer la classe
          </h3>
          {classroom.joinCode ? (
            <>
              <p className="mt-1 text-sm text-ink">
                Donnez ce code à vos élèves : ils le saisissent dans « Mes classes ».
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <p className="rounded-control border border-line-strong bg-surface px-4 py-2 font-mono text-2xl font-semibold tracking-widest text-ink">
                  {formatJoinCode(classroom.joinCode)}
                </p>
                <button type="button" onClick={() => void copyCode(classroom.joinCode ?? '')} className={primaryButtonClass}>
                  Copier le code
                </button>
                <button
                  type="button"
                  onClick={() => setPendingAction({ kind: 'regenerate' })}
                  disabled={busy}
                  className={secondaryButtonClass}
                >
                  Nouveau code
                </button>
                <button type="button" onClick={startRenaming} disabled={busy} className={secondaryButtonClass}>
                  Renommer la classe
                </button>
              </div>
            </>
          ) : (
            <p className="mt-1 text-sm text-ink">Le code de cette classe n'est pas disponible.</p>
          )}
          <div className="mt-5 border-t border-line pt-4">
            <button
              type="button"
              onClick={() => setPendingAction({ kind: 'delete' })}
              disabled={busy}
              className={dangerButtonClass}
            >
              Supprimer la classe
            </button>
            <p className="mt-1.5 text-xs text-ink-soft">
              Tous les membres en seront retirés. Cette action est définitive.
            </p>
          </div>
        </section>
      )}

      <div>
        <Tabs label="Sections de la classe" items={tabs} value={tab} onChange={setTab} idBase={idBase} />

        {tab === 'eleves' && (
          <TabPanel idBase={idBase} value="eleves">
            <section aria-labelledby="prof-titre" className="rounded-card border border-line bg-surface p-5 shadow-soft">
              <h3 id="prof-titre" className="text-base font-semibold text-ink">
                Prof
              </h3>
              <div className="mt-3">
                {classroom.teacher ? (
                  <PersonCard person={classroom.teacher} />
                ) : (
                  <p className="text-sm text-ink-soft">Inconnu</p>
                )}
              </div>
            </section>

            <section aria-labelledby="membres-titre" className="mt-4">
              <h3 id="membres-titre" className="text-base font-semibold text-ink">
                {isTeacher ? 'Membres' : 'Camarades'} ({classroom.members.length})
              </h3>
              {classroom.members.length === 0 ? (
                <p className="mt-3 rounded-card border border-dashed border-line-strong bg-surface-soft p-6 text-center text-sm text-ink-soft">
                  {isTeacher
                    ? 'Personne pour l’instant : partagez le code ci-dessus à vos élèves.'
                    : 'Aucun autre membre pour l’instant.'}
                </p>
              ) : (
                <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                  {classroom.members.map((member) => (
                    <li
                      key={member.id}
                      className="flex flex-wrap items-start justify-between gap-3 rounded-card border border-line bg-surface p-4 shadow-soft"
                    >
                      <PersonCard
                        person={member}
                        extra={isTeacher && member.joinedAt ? `Arrivé le ${formatDate(member.joinedAt)}` : undefined}
                      />
                      {isTeacher && (
                        <button
                          type="button"
                          onClick={() => setPendingAction({ kind: 'remove', member })}
                          disabled={busy}
                          aria-label={`Retirer ${displayName(member)} de la classe`}
                          className="inline-flex min-h-8 items-center rounded-control border border-danger bg-surface px-3 py-1 text-xs font-medium text-danger transition-colors duration-150 hover:bg-danger-soft hover:text-danger"
                        >
                          Retirer
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {!isTeacher && (
              <div className="mt-6 border-t border-line pt-4">
                <button
                  type="button"
                  onClick={() => setPendingAction({ kind: 'leave' })}
                  disabled={busy}
                  className={dangerButtonClass}
                >
                  Quitter la classe
                </button>
              </div>
            )}
          </TabPanel>
        )}

        {tab === 'exercices' && (
          <TabPanel idBase={idBase} value="exercices">
            {isTeacher ? (
              <AssignmentsPanel
                client={client}
                classroomId={classroom.id}
                classroomName={classroom.name}
                openAssignmentId={openAssignmentId}
                openSubmissionId={openSubmissionId}
                onEditAssignmentModel={onEditAssignmentModel}
                onOpenReadOnlyModel={onOpenReadOnlyModel}
              />
            ) : (
              <StudentAssignmentsPanel
                client={client}
                classroomId={classroom.id}
                openAssignmentId={openAssignmentId}
                onOpenWorkDocument={onOpenWorkDocument}
                onOpenReadOnlyModel={onOpenReadOnlyModel}
              />
            )}
          </TabPanel>
        )}

        {tab === 'cours' && (
          <TabPanel idBase={idBase} value="cours">
            {isTeacher ? (
              <LessonsPanel client={client} classroomId={classroom.id} classroomName={classroom.name} />
            ) : (
              <StudentLessonsPanel client={client} classroomId={classroom.id} />
            )}
          </TabPanel>
        )}
      </div>
      <ConfirmDialog
        open={pendingAction !== null}
        title={pendingAction ? dialogText[pendingAction.kind].title : ''}
        message={pendingAction ? dialogText[pendingAction.kind].message : ''}
        confirmLabel={pendingAction ? dialogText[pendingAction.kind].confirm : ''}
        onConfirm={() => void confirm()}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  )
}
