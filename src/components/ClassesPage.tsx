import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { ApiClient } from '../lib/apiClient'
import type { ApiUser } from '../lib/authApi'
import { displayName } from '../lib/authApi'
import { createClassroom, joinClassroom, listClassrooms, normalizeJoinCode } from '../lib/classroomsApi'
import type { ClassroomDetail, ClassroomSummary } from '../lib/classroomsApi'
import { ClassroomView } from './ClassroomView'
import { FormField } from './FormField'
import { PageShell } from './PageShell'
import { primaryButtonClass, smallButtonClass } from './buttonStyles'

interface ClassesPageProps {
  user: ApiUser
  /** Client lié au compte connecté. */
  client: ApiClient
  onBack: () => void
}

/**
 * Mes classes : rejoindre par code, et, pour un compte prof, créer une
 * classe. Une classe choisie s'ouvre en détail. Rien n'est gardé dans le
 * navigateur : tout est relu auprès du serveur pour le compte connecté.
 */
export function ClassesPage({ user, client, onBack }: ClassesPageProps) {
  const [classrooms, setClassrooms] = useState<ClassroomSummary[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selected, setSelected] = useState<{ id: string; initial: ClassroomDetail | null; message: string | null } | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | undefined>()
  const [joining, setJoining] = useState(false)
  const [className, setClassName] = useState('')
  const [nameError, setNameError] = useState<string | undefined>()
  const [creating, setCreating] = useState(false)
  const codeRef = useRef<HTMLInputElement>(null)

  const canCreate = user.role === 'teacher'

  const load = useCallback(async () => {
    setLoadError(null)
    const result = await listClassrooms(client)
    if (result.ok) {
      setClassrooms(result.value)
    } else {
      setLoadError(result.error.message)
    }
  }, [client])

  useEffect(() => {
    void load()
  }, [load])

  const submitJoin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (joining) return
    const normalized = normalizeJoinCode(code)
    if (normalized.length === 0) {
      setCodeError('Saisissez le code donné par votre prof.')
      codeRef.current?.focus()
      return
    }
    setJoining(true)
    setCodeError(undefined)
    const result = await joinClassroom(client, code)
    setJoining(false)
    if (result.ok) {
      setCode('')
      setSelected({ id: result.value.id, initial: result.value, message: `Vous avez rejoint la classe « ${result.value.name} ».` })
      void load()
    } else {
      setCodeError(result.error.fieldErrors.code?.[0] ?? result.error.message)
      codeRef.current?.focus()
    }
  }

  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (creating) return
    setCreating(true)
    setNameError(undefined)
    const result = await createClassroom(client, className.trim())
    setCreating(false)
    if (result.ok) {
      setClassName('')
      setSelected({ id: result.value.id, initial: result.value, message: `Classe « ${result.value.name} » créée. Partagez son code à vos élèves.` })
      void load()
    } else {
      setNameError(result.error.fieldErrors.name?.[0] ?? result.error.message)
    }
  }

  const backToList = useCallback(
    (message: string | null) => {
      setSelected(null)
      setStatus(message)
      void load()
    },
    [load],
  )

  if (selected) {
    return (
      <PageShell title="Classe" focusKey={selected.id} onBack={() => backToList(null)} backLabel="Retour à mes classes">
        <ClassroomView
          key={selected.id}
          client={client}
          classroomId={selected.id}
          initial={selected.initial}
          onGone={(message) => backToList(message)}
          initialStatus={selected.message}
        />
      </PageShell>
    )
  }

  return (
    <PageShell title="Mes classes" onBack={onBack}>
      <p role="status" aria-live="polite" className="min-h-5 text-sm">
        {status && (
          <span className="inline-flex items-center gap-1.5 rounded border border-zinc-300 bg-surface px-2.5 py-1 text-zinc-800">
            <span aria-hidden="true">✓</span>
            {status}
          </span>
        )}
      </p>

      <div className={`mt-3 grid gap-4 ${canCreate ? 'md:grid-cols-2' : ''}`}>
        <section aria-labelledby="rejoindre-titre" className="rounded-lg border border-line bg-surface p-5 shadow-sm">
          <h2 id="rejoindre-titre" className="text-sm font-semibold">
            Rejoindre une classe
          </h2>
          <form onSubmit={(event) => void submitJoin(event)} className="mt-3 flex flex-col gap-3">
            <FormField
              label="Code de la classe"
              type="text"
              value={code}
              onChange={setCode}
              autoComplete="off"
              maxLength={20}
              mono
              hint="8 caractères donnés par votre prof. Minuscules, espaces et tirets acceptés."
              error={codeError}
              inputRef={codeRef}
            />
            <button type="submit" disabled={joining} className={`${primaryButtonClass} self-start`}>
              {joining ? 'Vérification…' : 'Rejoindre'}
            </button>
          </form>
        </section>

        {canCreate && (
          <section aria-labelledby="creer-titre" className="rounded-lg border border-line bg-surface p-5 shadow-sm">
            <h2 id="creer-titre" className="text-sm font-semibold">
              Créer une classe
            </h2>
            <form onSubmit={(event) => void submitCreate(event)} className="mt-3 flex flex-col gap-3">
              <FormField
                label="Nom de la classe"
                type="text"
                value={className}
                onChange={setClassName}
                autoComplete="off"
                maxLength={100}
                hint="Par exemple : BUT MMI 2, groupe B."
                error={nameError}
              />
              <button type="submit" disabled={creating} className={`${primaryButtonClass} self-start`}>
                {creating ? 'Création…' : 'Créer la classe'}
              </button>
            </form>
          </section>
        )}
      </div>

      <section aria-labelledby="liste-titre" className="mt-6">
        <h2 id="liste-titre" className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
          Vos classes{classrooms && classrooms.length > 0 ? ` (${classrooms.length})` : ''}
        </h2>
        {loadError ? (
          <p className="mt-2 flex flex-wrap items-center gap-2 rounded border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-zinc-800">
            <span aria-hidden="true">⚠</span>
            {loadError}
            <button type="button" onClick={() => void load()} className={smallButtonClass}>
              Réessayer
            </button>
          </p>
        ) : classrooms === null ? (
          <p role="status" className="mt-2 text-sm text-zinc-600">
            Chargement de vos classes…
          </p>
        ) : classrooms.length === 0 ? (
          <p className="mt-2 rounded-lg border border-dashed border-zinc-300 bg-surface p-6 text-center text-sm text-zinc-600">
            {canCreate
              ? 'Aucune classe pour l’instant : créez-en une, ou rejoignez celle d’un collègue.'
              : 'Aucune classe pour l’instant : saisissez le code donné par votre prof.'}
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {classrooms.map((classroom) => (
              <li key={classroom.id}>
                <button
                  type="button"
                  onClick={() => setSelected({ id: classroom.id, initial: null, message: null })}
                  className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface p-3 text-left shadow-sm hover:bg-indigo-50"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">{classroom.name}</span>
                    <span className="block text-xs text-zinc-600">
                      {classroom.teacher ? `Prof : ${displayName(classroom.teacher)}` : 'Prof inconnu'}
                      {classroom.membersCount !== null &&
                        ` · ${classroom.membersCount} membre${classroom.membersCount > 1 ? 's' : ''}`}
                    </span>
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                      classroom.myRole === 'teacher'
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-800'
                        : 'border-zinc-300 bg-shell text-zinc-700'
                    }`}
                  >
                    {classroom.myRole === 'teacher' ? 'Prof' : 'Élève'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  )
}
