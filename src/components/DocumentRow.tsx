import { useEffect, useId, useRef, useState } from 'react'
import type { DocumentMeta } from '../model/document'
import { Badge } from './ui/Badge'
import type { BadgeTone } from './ui/Badge'
import { buttonClass } from './ui/buttonClass'
import { formatDate } from '../lib/formatDate'

interface DocumentRowProps {
  meta: DocumentMeta
  onOpen: () => void
  onRename: (name: string) => void
  onDuplicate: () => void
  onRequestDelete: () => void
  /** Pastille de provenance (ex. « Perso »), écrite en toutes lettres. */
  provenance?: { label: string; tone: BadgeTone }
}

const actionClass = buttonClass({ variant: 'secondary', size: 'sm' })

/**
 * Une ligne de la liste des documents : ouvrir d'un clic, renommer sur
 * place, dupliquer, supprimer (la confirmation est gérée par la liste).
 */
export function DocumentRow({ meta, onOpen, onRename, onDuplicate, onRequestDelete, provenance }: DocumentRowProps) {
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
    <li className="flex flex-wrap items-center gap-2 rounded-card border border-line bg-surface p-2 shadow-soft">
      {editing ? (
        <div className="min-w-0 flex-1 px-2 py-1">
          <label htmlFor={inputId} className="block text-xs font-medium text-ink-soft">
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
            className="mt-1 w-full rounded-control border border-line-strong bg-surface px-3 py-1.5 text-sm text-ink"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Ouvrir ${meta.name}${provenance ? `, ${provenance.label}` : ''}`}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-control px-3 py-2 text-left transition-colors duration-150 hover:bg-accent-soft"
        >
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-accent-soft font-mono text-xs font-semibold text-accent-ink"
          >
            MCD
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-semibold text-ink">{meta.name}</span>
              {provenance && <Badge tone={provenance.tone}>{provenance.label}</Badge>}
            </span>
            <span className="block text-xs text-ink-soft">Modifié le {formatDate(meta.updatedAt)}</span>
          </span>
        </button>
      )}

      <div role="group" aria-label={`Actions pour ${meta.name}`} className="flex shrink-0 gap-1.5 pr-1">
        <button
          ref={renameButtonRef}
          type="button"
          onClick={startEditing}
          disabled={editing}
          aria-label={`Renommer ${meta.name}`}
          className={actionClass}
        >
          Renommer
        </button>
        <button type="button" onClick={onDuplicate} aria-label={`Dupliquer ${meta.name}`} className={actionClass}>
          Dupliquer
        </button>
        <button
          type="button"
          onClick={onRequestDelete}
          aria-label={`Supprimer ${meta.name}`}
          className="inline-flex min-h-8 items-center rounded-control border border-danger bg-surface px-3 py-1 text-xs font-medium text-danger transition-colors duration-150 hover:bg-danger-soft hover:text-danger"
        >
          Supprimer
        </button>
      </div>
    </li>
  )
}
