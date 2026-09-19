import type { ClassroomsState } from '../lib/useClassrooms'
import type { ClassroomSummary } from '../lib/classroomsApi'
import { ClassroomCard } from './ClassroomCard'
import { Button } from './ui/Button'
import { Notice } from './ui/Notice'

interface ClassroomGridProps {
  state: ClassroomsState
  onOpen: (classroom: ClassroomSummary) => void
  onCopyCode?: (code: string) => void
  emptyText: string
}

/** Classes en cartes, avec les états chargement, erreur et vide. */
export function ClassroomGrid({ state, onOpen, onCopyCode, emptyText }: ClassroomGridProps) {
  const { classrooms, error, reload } = state
  if (error) {
    return (
      <Notice
        tone="warning"
        announce={false}
        action={
          <Button size="sm" onClick={() => void reload()}>
            Réessayer
          </Button>
        }
      >
        {error}
      </Notice>
    )
  }
  if (classrooms === null) {
    return (
      <p role="status" className="text-sm text-ink-soft">
        Chargement de vos classes…
      </p>
    )
  }
  if (classrooms.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-line-strong bg-surface p-6 text-center text-sm text-ink-soft">
        {emptyText}
      </p>
    )
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {classrooms.map((classroom) => (
        <ClassroomCard
          key={classroom.id}
          classroom={classroom}
          onOpen={() => onOpen(classroom)}
          onCopyCode={onCopyCode}
        />
      ))}
    </ul>
  )
}
