import { useEffect, useId, useRef, useState } from 'react'
import type { DocumentMeta } from '../model/document'

interface DocumentRowProps {
  meta: DocumentMeta
  onOpen: () => void
  onRename: (name: string) => void
  onDuplicate: () => void
  onRequestDelete: () => void
}

const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' })

/** « 15 septembre 2026 à 11:29 », ou un repli si la date est illisible. */
function formatDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? 'date inconnue' : dateFormat.format(date)
}

const actionClass =
  'rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs text-ink hover:bg-shell'

/**
 * Une ligne de la liste des documents : ouvrir d'un clic, renommer sur
 * place, dupliquer, supprimer (la confirmation est gérée par l'accueil).
 */
export function DocumentRow({ meta, onOpen, onRename, onDuplicate, onRequestDelete }: DocumentRowProps) {
  const inputId = useId()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(meta.name)
  const inputRef = useRef<HTMLInputElement>(null)
  const renameButtonRef = useRef<HTMLButtonElement>(null)
  // Entrée ou Échap rendent le focus au bouton Renommer. Une perte de
  // focus vers ailleurs laisse le focus là où l'utilisateur est allé.
  const restoreFocus = useRef(false)
  // Entrée démonte le champ, ce qui peut déclencher un blur : la fin
  // d'édition ne doit s'appliquer qu'une fois.
  const editingActive = useRef(false)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    } else if (restoreFocus.current) {
      restoreFocus.current = false
      renameButtonRef.current?.focus()
    }
  }, [editing])

  const startEditing = () => {
    editingActive.current = true
    setDraft(meta.name)
    setEditing(true)
  }

  const finishEditing = (commit: boolean, returnFocus: boolean) => {
    if (!editingActive.current) {
      return
    }
    editingActive.current = false
    const trimmed = draft.trim()
    if (commit && trimmed !== '' && trimmed !== meta.name) {
      onRename(trimmed)
    }
    restoreFocus.current = returnFocus
    setEditing(false)
  }

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface p-2 shadow-sm">
      {editing ? (
        <div className="min-w-0 flex-1 px-1">
          <label htmlFor={inputId} className="block text-xs font-medium text-zinc-600">
            Nouveau nom de « {meta.name} »
          </label>
          <input
            id={inputId}
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => finishEditing(true, false)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                finishEditing(true, true)
              } else if (event.key === 'Escape') {
                event.preventDefault()
                finishEditing(false, true)
              }
            }}
            className="mt-0.5 w-full rounded border border-zinc-300 bg-surface px-2 py-1 text-sm"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Ouvrir ${meta.name}`}
          className="min-w-0 flex-1 rounded-md px-2 py-1.5 text-left hover:bg-indigo-50"
        >
          <span className="block truncate text-sm font-semibold text-ink">{meta.name}</span>
          <span className="block text-xs text-zinc-600">Modifié le {formatDate(meta.updatedAt)}</span>
        </button>
      )}

      <div role="group" aria-label={`Actions pour ${meta.name}`} className="flex shrink-0 gap-1.5">
        <button
          ref={renameButtonRef}
          type="button"
          onClick={startEditing}
          disabled={editing}
          aria-label={`Renommer ${meta.name}`}
          className={`${actionClass} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          Renommer
        </button>
        <button
          type="button"
          onClick={onDuplicate}
          aria-label={`Dupliquer ${meta.name}`}
          className={actionClass}
        >
          Dupliquer
        </button>
        <button
          type="button"
          onClick={onRequestDelete}
          aria-label={`Supprimer ${meta.name}`}
          className="rounded-md border border-rose-300 bg-surface px-2.5 py-1.5 text-xs text-rose-700 hover:bg-rose-50"
        >
          Supprimer
        </button>
      </div>
    </li>
  )
}
