import { useId, useState } from 'react'

interface DocumentNameFieldProps {
  name: string
  /** false : refus (serveur injoignable, stockage plein), le nom revient. */
  onRename: (name: string) => Promise<boolean>
}

/**
 * Nom du document courant, modifiable sur place. Validé à la perte du
 * focus ou avec Entrée, annulé avec Échap. Un nom vide n'est jamais
 * enregistré : le champ revient au nom précédent.
 */
export function DocumentNameField({ name, onRename }: DocumentNameFieldProps) {
  const inputId = useId()
  const [draft, setDraft] = useState(name)
  // Nom changé ailleurs (accueil, import) : le brouillon suit.
  const [shownName, setShownName] = useState(name)
  if (name !== shownName) {
    setShownName(name)
    setDraft(name)
  }

  const commit = () => {
    const trimmed = draft.trim()
    if (trimmed === '') {
      setDraft(name)
      return
    }
    if (trimmed === name) {
      return
    }
    void onRename(trimmed).then((renamed) => {
      if (!renamed) {
        setDraft(name)
      }
    })
  }

  return (
    <div className="flex min-w-0 items-center">
      <label htmlFor={inputId} className="sr-only">
        Nom du document
      </label>
      <input
        id={inputId}
        type="text"
        value={draft}
        title="Renommer le document"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commit()
          } else if (event.key === 'Escape') {
            event.preventDefault()
            setDraft(name)
          }
        }}
        className="w-56 max-w-full min-w-0 rounded-control border border-line bg-surface px-2 py-1 text-sm font-medium hover:border-ink-soft"
      />
    </div>
  )
}
