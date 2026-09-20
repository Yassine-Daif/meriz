import { useId, useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { panelId, tabId } from './tabIds'

export interface TabItem<T extends string> {
  value: T
  label: string
  /** Nombre affiché à côté du libellé (ex. l'effectif). */
  count?: number
}

interface TabsProps<T extends string> {
  /** Nom du groupe d'onglets, pour les lecteurs d'écran. */
  label: string
  items: readonly TabItem<T>[]
  value: T
  onChange: (value: T) => void
  /** Identifiant commun des onglets et des panneaux. */
  idBase?: string
}


/**
 * Onglets d'une page : flèches gauche et droite pour passer de l'un à
 * l'autre, Début et Fin pour les extrémités. L'onglet courant est
 * marqué par le gras et par un trait épais, jamais par la seule
 * couleur.
 */
export function Tabs<T extends string>({ label, items, value, onChange, idBase }: TabsProps<T>) {
  const generated = useId()
  const base = idBase ?? generated
  // Les boutons sont gardés par valeur : le focus suit le choix sans
  // dépendre d'un sélecteur (les identifiants de React ne s'y prêtent pas).
  const buttons = useRef(new Map<string, HTMLButtonElement>())

  const move = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = items.findIndex((item) => item.value === value)
    let next = index
    if (event.key === 'ArrowRight') next = (index + 1) % items.length
    else if (event.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = items.length - 1
    else return
    event.preventDefault()
    const item = items[next]
    if (!item) return
    onChange(item.value)
    // Le focus suit l'onglet choisi, comme l'attend la navigation au clavier.
    buttons.current.get(item.value)?.focus()
  }

  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-1 border-b border-line">
      {items.map((item) => {
        const selected = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            ref={(element) => {
              if (element) buttons.current.set(item.value, element)
              else buttons.current.delete(item.value)
            }}
            id={tabId(base, item.value)}
            aria-selected={selected}
            aria-controls={panelId(base, item.value)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={move}
            className={`-mb-px rounded-t-control border-b-3 px-4 py-2.5 text-sm transition-colors duration-150 ${
              selected
                ? 'border-mark font-semibold text-ink'
                : 'border-transparent font-medium text-ink-soft hover:bg-surface-soft hover:text-ink'
            }`}
          >
            {item.label}
            {item.count !== undefined && (
              <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${selected ? 'bg-accent-soft text-accent-ink' : 'bg-surface-soft text-ink-soft'}`}>
                {item.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

interface TabPanelProps {
  idBase: string
  value: string
  /** Panneau de l'onglet courant : les autres ne sont pas rendus. */
  children: ReactNode
}

export function TabPanel({ idBase, value, children }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      id={panelId(idBase, value)}
      aria-labelledby={tabId(idBase, value)}
      tabIndex={0}
      className="pt-6 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      {children}
    </div>
  )
}
