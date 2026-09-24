import { useCallback, useEffect, useState } from 'react'
import type { ApiClient } from '../../lib/apiClient'
import { createLesson, getLesson, lessonStateLabel, listClassroomLessons, mediaCountLabel } from '../../lib/lessonsApi'
import type { Lesson, LessonSummary } from '../../lib/lessonsApi'
import { serializeBlocks } from '../../lib/lessonBlocks'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Notice } from '../ui/Notice'
import { FormField } from '../FormField'
import { FormAlert } from '../FormAlert'
import { LessonEditor } from './LessonEditor'

interface LessonsPanelProps {
  client: ApiClient
  classroomId: string
  classroomName: string
}

/** Ce que l'on regarde : la liste, la création, ou un cours ouvert. */
type View = { kind: 'list' } | { kind: 'create' } | { kind: 'edit'; lesson: Lesson }

/**
 * Cours d'une classe, côté prof : la liste, la création, et l'éditeur
 * d'un cours. Un cours naît avec son seul titre, parce que ses fichiers
 * ont besoin d'un cours existant pour être envoyés.
 */
export function LessonsPanel({ client, classroomId, classroomName }: LessonsPanelProps) {
  const [lessons, setLessons] = useState<LessonSummary[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [view, setView] = useState<View>({ kind: 'list' })
  const [status, setStatus] = useState<string | null>(null)
  const [opening, setOpening] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [titleError, setTitleError] = useState<string | undefined>()
  const [attempt, setAttempt] = useState(0)
  const [pending, setPending] = useState(false)

  const load = useCallback(async () => {
    setLoadError(null)
    const result = await listClassroomLessons(client, classroomId)
    if (result.ok) setLessons(result.value)
    else setLoadError(result.error.message)
  }, [client, classroomId])

  useEffect(() => {
    void load()
  }, [load])

  const open = async (id: string) => {
    setOpening(id)
    const result = await getLesson(client, id)
    setOpening(null)
    if (result.ok) {
      setStatus(null)
      setView({ kind: 'edit', lesson: result.value })
    } else {
      setStatus(result.error.message)
      void load()
    }
  }

  const create = async () => {
    if (pending) return
    setPending(true)
    setFormError(null)
    setTitleError(undefined)
    const result = await createLesson(client, classroomId, {
      title: title.trim(),
      blocks: serializeBlocks([]),
    })
    setPending(false)
    if (result.ok) {
      setTitle('')
      setView({ kind: 'edit', lesson: result.value })
      void load()
      return
    }
    const message = result.error.fieldErrors.title?.[0]
    setTitleError(message)
    setFormError(message ? 'Vérifiez le titre.' : result.error.message)
    setAttempt((count) => count + 1)
  }

  if (view.kind === 'edit') {
    return (
      <LessonEditor
        key={view.lesson.id}
        client={client}
        classroomName={classroomName}
        lesson={view.lesson}
        onDone={(message) => {
          setView({ kind: 'list' })
          setStatus(message)
          void load()
        }}
        onChanged={() => void load()}
      />
    )
  }

  if (view.kind === 'create') {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={() => setView({ kind: 'list' })} className="-ml-3 mb-3">
          <span aria-hidden="true">←</span>
          Retour aux cours
        </Button>
        <h3 className="text-xl font-semibold tracking-tight text-ink">Créer un cours</h3>
        <p className="mt-1 text-sm text-ink-soft">
          Classe {classroomName}. Donnez un titre, puis composez la page : le cours reste en brouillon tant que vous ne
          l’avez pas publié.
        </p>
        <div className="mt-5 flex max-w-md flex-col gap-4">
          <FormAlert message={formError} attempt={attempt} />
          <FormField
            label="Titre du cours"
            type="text"
            value={title}
            onChange={setTitle}
            autoComplete="off"
            maxLength={200}
            hint="Ce que vos élèves verront dans la liste."
            error={titleError}
          />
          <div>
            <Button variant="primary" onClick={() => void create()} loading={pending} loadingLabel="Création…">
              Créer le cours
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <section aria-labelledby="cours-titre">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="cours-titre" className="text-base font-semibold text-ink">
          Cours de la classe
          {lessons && lessons.length > 0 && <span className="font-normal text-ink-soft"> ({lessons.length})</span>}
        </h3>
        <Button variant="primary" onClick={() => setView({ kind: 'create' })}>
          <span aria-hidden="true">+</span>
          Créer un cours
        </Button>
      </div>

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
      ) : lessons === null ? (
        <p role="status" className="text-sm text-ink-soft">
          Chargement des cours…
        </p>
      ) : lessons.length === 0 ? (
        <p className="rounded-card border border-dashed border-line-strong bg-surface-soft p-6 text-center text-sm text-ink-soft">
          Aucun cours pour l’instant : créez le premier, il restera en brouillon tant que vous ne l’aurez pas publié.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {lessons.map((lesson) => (
            <li key={lesson.id}>
              <button
                type="button"
                onClick={() => void open(lesson.id)}
                disabled={opening !== null}
                aria-label={`Ouvrir le cours ${lesson.title}`}
                className="flex w-full flex-col items-start gap-1.5 rounded-card border border-line bg-surface p-4 text-left shadow-soft transition duration-150 hover:shadow-lift disabled:cursor-wait motion-safe:hover:-translate-y-0.5"
              >
                <span className="flex w-full flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink">{lesson.title}</span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={lesson.status === 'published' ? 'sage' : 'neutral'}>{lessonStateLabel(lesson)}</Badge>
                    {lesson.mediaCount > 0 && <Badge tone="sky">{mediaCountLabel(lesson.mediaCount)}</Badge>}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
