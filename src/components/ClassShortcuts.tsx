import { useId, useState } from 'react'
import type { ClassroomSummary } from '../lib/classroomsApi'
import type { ClassroomOpening } from './ClassesPage'
import type { ClassroomTab } from './ClassroomView'
import { Button } from './ui/Button'

/** Un raccourci : où il mène dans la classe, et ce qu'on y trouve. */
export interface ClassShortcut {
  tab: ClassroomTab
  label: string
  description: string
}

interface ClassShortcutsProps {
  title: string
  /** Classes déjà chargées par l'accueil : rien n'est rechargé ici. */
  classrooms: readonly ClassroomSummary[]
  shortcuts: readonly ClassShortcut[]
  /** Phrase sous les boutons, pour ce qui n'a pas de raccourci propre. */
  hint?: string
  onOpen: (opening: ClassroomOpening) => void
}

/**
 * Raccourcis vers une classe, depuis un accueil. Un devoir et un cours
 * appartiennent toujours à une classe : le raccourci commence donc par
 * savoir laquelle, puis ouvre le bon onglet.
 *
 * Sans classe, il n'y a rien à proposer : le bloc ne s'affiche pas.
 */
export function ClassShortcuts({ title, classrooms, shortcuts, hint, onOpen }: ClassShortcutsProps) {
  const selectId = useId()
  const titleId = `${selectId}-titre`
  const [chosen, setChosen] = useState(classrooms[0]?.id ?? '')

  if (classrooms.length === 0) {
    return null
  }

  // Une classe ajoutée depuis le premier rendu : on retombe sur la première.
  const current = classrooms.find((classroom) => classroom.id === chosen) ?? classrooms[0]
  if (!current) {
    return null
  }
  const only = classrooms.length === 1

  return (
    <section aria-labelledby={titleId}>
      <h2 id={titleId} className="text-lg font-semibold tracking-tight text-ink">
        {title}
      </h2>

      <div className="mt-3 rounded-card border border-line bg-surface p-5 shadow-soft">
        {only ? (
          <p className="text-sm text-ink">
            Classe <strong className="font-semibold">{current.name}</strong>.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={selectId} className="text-sm font-medium text-ink">
              Classe
            </label>
            <select
              id={selectId}
              value={current.id}
              onChange={(event) => setChosen(event.target.value)}
              className="rounded-control border border-line-strong bg-surface px-3 py-2 text-sm text-ink"
            >
              {classrooms.map((classroom) => (
                <option key={classroom.id} value={classroom.id}>
                  {classroom.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {shortcuts.map((shortcut) => (
            <li key={shortcut.tab} className="rounded-card bg-surface-soft p-4">
              <p className="text-sm text-ink-soft">{shortcut.description}</p>
              <div className="mt-3">
                <Button
                  onClick={() => onOpen({ id: current.id, initial: null, message: null, tab: shortcut.tab })}
                  aria-label={`${shortcut.label} de la classe ${current.name}`}
                >
                  {shortcut.label}
                </Button>
              </div>
            </li>
          ))}
        </ul>

        {hint && <p className="mt-4 text-sm text-ink-soft">{hint}</p>}
      </div>
    </section>
  )
}
