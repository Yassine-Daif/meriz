import { displayName } from '../lib/authApi'
import { formatJoinCode } from '../lib/classroomsApi'
import type { ClassroomSummary } from '../lib/classroomsApi'
import { Badge } from './ui/Badge'

interface ClassroomCardProps {
  classroom: ClassroomSummary
  onOpen: () => void
  /** Copie du code (prof de la classe seulement, le code n'arrive qu'à lui). */
  onCopyCode?: (code: string) => void
}

/**
 * Carte d'une classe : nom, prof, effectif, et mon rôle écrit en toutes
 * lettres. Côté prof, le code et un bouton pour le copier.
 */
export function ClassroomCard({ classroom, onOpen, onCopyCode }: ClassroomCardProps) {
  const teacher = classroom.myRole === 'teacher'
  return (
    <li className="flex flex-col rounded-card border border-line bg-surface shadow-soft transition duration-150 hover:shadow-lift">
      <button
        type="button"
        onClick={onOpen}
        className="flex flex-1 flex-col items-start gap-2 rounded-card p-4 text-left"
      >
        <span className="flex w-full items-start justify-between gap-2">
          <span className="text-base font-semibold text-ink">{classroom.name}</span>
          <Badge tone={teacher ? 'accent' : 'sky'}>{teacher ? 'Prof' : 'Élève'}</Badge>
        </span>
        <span className="text-sm text-ink-soft">
          {classroom.teacher ? `Prof : ${displayName(classroom.teacher)}` : 'Prof inconnu'}
          {classroom.membersCount !== null &&
            ` · ${classroom.membersCount} membre${classroom.membersCount > 1 ? 's' : ''}`}
        </span>
      </button>
      {teacher && classroom.joinCode && onCopyCode && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-2.5">
          <span className="text-xs text-ink-soft">Code</span>
          <span className="font-mono text-sm font-semibold tracking-widest text-ink">
            {formatJoinCode(classroom.joinCode)}
          </span>
          <button
            type="button"
            onClick={() => onCopyCode(classroom.joinCode ?? '')}
            aria-label={`Copier le code de ${classroom.name}`}
            className="ml-auto rounded-control px-2.5 py-1 text-xs font-medium text-accent-ink transition-colors duration-150 hover:bg-accent-soft hover:text-accent-ink"
          >
            Copier
          </button>
        </div>
      )}
    </li>
  )
}
