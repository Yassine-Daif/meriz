import { useCallback, useEffect, useRef, useState } from 'react'
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
import { FormField } from './FormField'
import { primaryButtonClass, secondaryButtonClass, smallButtonClass } from './buttonStyles'

interface ClassroomViewProps {
  client: ApiClient
  classroomId: string
  /** Vue déjà connue (création, adhésion) : affichée sans attendre. */
  initial: ClassroomDetail | null
  /** La classe n'est plus accessible (quittée, supprimée) : retour à la liste. */
  onGone: (message: string) => void
  /** Message à annoncer à l'arrivée (classe rejointe ou créée). */
  initialStatus?: string | null
}

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

/** Une personne telle qu'autrui la voit : nom, et ce qu'elle partage. */
function PersonCard({ person, extra }: { person: PublicProfile; extra?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-semibold text-ink">{displayName(person)}</p>
      {person.bio && <p className="mt-0.5 text-sm text-zinc-700">{person.bio}</p>}
      {person.contact && (
        <p className="mt-0.5 text-xs text-zinc-700">
          Contact : <span className="font-mono">{person.contact}</span>
        </p>
      )}
      {extra && <p className="mt-0.5 text-xs text-zinc-600">{extra}</p>}
    </div>
  )
}

/**
 * Une classe. Pour tous : nom, prof et camarades, sans email. Pour le
 * prof de la classe : code à partager, dates d'arrivée, et la gestion
 * (renommer, nouveau code, retirer, supprimer), chaque action
 * destructive étant confirmée.
 */
export function ClassroomView({ client, classroomId, initial, onGone, initialStatus = null }: ClassroomViewProps) {
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
      <div className="rounded-lg border border-line bg-surface p-6 text-sm">
        {loadError ? (
          <p className="flex flex-wrap items-center gap-2">
            <span aria-hidden="true">⚠</span>
            {loadError}
            <button type="button" onClick={() => void load()} className={smallButtonClass}>
              Réessayer
            </button>
          </p>
        ) : (
          <p role="status">Chargement de la classe…</p>
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
            <h2 className="text-xl font-semibold tracking-tight">{classroom.name}</h2>
            <p className="text-sm text-zinc-600">
              {isTeacher ? 'Vous êtes le prof de cette classe.' : 'Vous êtes élève dans cette classe.'}
            </p>
          </div>
        )}
        {isTeacher && !renaming && (
          <button
            type="button"
            onClick={() => {
              setNewName(classroom.name)
              setRenameError(undefined)
              setRenaming(true)
            }}
            className={smallButtonClass}
          >
            Renommer
          </button>
        )}
      </div>

      <p role="status" aria-live="polite" className="min-h-5 text-sm">
        {status && (
          <span
            className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-zinc-800 ${
              status.kind === 'error' ? 'border-amber-400 bg-amber-50' : 'border-zinc-300 bg-surface'
            }`}
          >
            <span aria-hidden="true">{status.kind === 'error' ? '⚠' : '✓'}</span>
            {status.text}
          </span>
        )}
      </p>

      {isTeacher && classroom.joinCode && (
        <section aria-labelledby="code-titre" className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
          <h3 id="code-titre" className="text-sm font-semibold text-ink">
            Code pour rejoindre
          </h3>
          <p className="mt-1 text-xs text-zinc-700">Donnez ce code à vos élèves : ils le saisissent dans « Mes classes ».</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <p className="rounded-md border border-indigo-300 bg-surface px-3 py-1.5 font-mono text-2xl font-semibold tracking-widest text-ink">
              {formatJoinCode(classroom.joinCode)}
            </p>
            <button
              type="button"
              onClick={() => void copyCode(classroom.joinCode ?? '')}
              className={primaryButtonClass}
            >
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
          </div>
        </section>
      )}

      <section aria-labelledby="prof-titre" className="rounded-lg border border-line bg-surface p-4 shadow-sm">
        <h3 id="prof-titre" className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
          Prof
        </h3>
        <div className="mt-2">
          {classroom.teacher ? <PersonCard person={classroom.teacher} /> : <p className="text-sm">Inconnu</p>}
        </div>
      </section>

      <section aria-labelledby="membres-titre" className="rounded-lg border border-line bg-surface p-4 shadow-sm">
        <h3 id="membres-titre" className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
          {isTeacher ? 'Membres' : 'Camarades'} ({classroom.members.length})
        </h3>
        {classroom.members.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600">
            {isTeacher ? 'Personne pour l’instant : partagez le code ci-dessus.' : 'Aucun membre.'}
          </p>
        ) : (
          <ul className="mt-2 flex flex-col divide-y divide-line">
            {classroom.members.map((member) => (
              <li key={member.id} className="flex flex-wrap items-start justify-between gap-3 py-2.5">
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
                    className="rounded-md border border-rose-300 bg-surface px-2.5 py-1.5 text-xs text-rose-700 hover:bg-rose-50"
                  >
                    Retirer
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div>
        {isTeacher ? (
          <button
            type="button"
            onClick={() => setPendingAction({ kind: 'delete' })}
            disabled={busy}
            className="rounded-md border border-rose-300 bg-surface px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
          >
            Supprimer la classe
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setPendingAction({ kind: 'leave' })}
            disabled={busy}
            className="rounded-md border border-rose-300 bg-surface px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
          >
            Quitter la classe
          </button>
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
