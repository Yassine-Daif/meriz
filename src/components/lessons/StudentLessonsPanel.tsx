import { useCallback, useEffect, useState } from 'react'
import type { ApiClient } from '../../lib/apiClient'
import { parseBlocks } from '../../lib/lessonBlocks'
import { getLesson, lessonStateLabel, listClassroomLessons, mediaCountLabel } from '../../lib/lessonsApi'
import type { Lesson, LessonSummary } from '../../lib/lessonsApi'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Notice } from '../ui/Notice'
import { LessonPage } from './LessonPage'

interface StudentLessonsPanelProps {
  client: ApiClient
  classroomId: string
}

type View = { kind: 'list' } | { kind: 'read'; lesson: Lesson }

/**
 * Cours d'une classe, côté élève : les cours publiés par le prof, et leur
 * lecture. Le serveur ne renvoie jamais un brouillon à un élève.
 */
export function StudentLessonsPanel({ client, classroomId }: StudentLessonsPanelProps) {
  const [lessons, setLessons] = useState<LessonSummary[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [view, setView] = useState<View>({ kind: 'list' })
  const [status, setStatus] = useState<string | null>(null)
  const [opening, setOpening] = useState<string | null>(null)

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
      setView({ kind: 'read', lesson: result.value })
    } else {
      setStatus(result.error.message)
      void load()
    }
  }

  if (view.kind === 'read') {
    const lesson = view.lesson
    return (
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setView({ kind: 'list' })
            void load()
          }}
          className="-ml-3 mb-3"
        >
          <span aria-hidden="true">←</span>
          Retour aux cours
        </Button>
        <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Cours</p>
        <h3 className="text-xl font-semibold tracking-tight text-ink">{lesson.title}</h3>
        <div className="mt-5">
          <LessonPage client={client} lessonId={lesson.id} blocks={parseBlocks(lesson.blocks)} />
        </div>
      </div>
    )
  }

  return (
    <section aria-labelledby="cours-eleve-titre">
      <h3 id="cours-eleve-titre" className="text-base font-semibold text-ink">
        Cours de la classe
        {lessons && lessons.length > 0 && <span className="font-normal text-ink-soft"> ({lessons.length})</span>}
      </h3>

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
          Aucun cours pour l’instant. Ceux que votre prof publiera apparaîtront ici.
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
                    <Badge tone="sage">{lessonStateLabel(lesson)}</Badge>
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
