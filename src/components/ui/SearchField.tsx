import { useId, useRef } from 'react'

interface SearchFieldProps {
  /** Libellé visible, qui nomme aussi le champ. */
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** Compte à annoncer, par exemple « 3 classes sur 12 ». */
  count?: string
}

/**
 * Recherche dans une liste, filtrée en direct à la frappe.
 *
 * Le compte vit dans une région polie permanente : un lecteur d'écran
 * entend le résultat sans quitter le champ, et la hauteur ne saute pas
 * quand il apparaît. Le bouton Effacer ne s'affiche qu'une fois le champ
 * rempli, et rend le focus au champ, pour ne pas renvoyer la main au
 * début de la page.
 */
export function SearchField({ label, value, onChange, placeholder, count }: SearchFieldProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <div className="mt-1.5 flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-soft"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75">
              <circle cx="7" cy="7" r="4.5" />
              <path d="m10.5 10.5 3 3" strokeLinecap="round" />
            </svg>
          </span>
          <input
            id={inputId}
            ref={inputRef}
            type="search"
            value={value}
            placeholder={placeholder}
            onChange={(event) => onChange(event.target.value)}
            className="w-full rounded-control border border-line-strong bg-surface py-2.5 pr-3.5 pl-10 text-sm text-ink placeholder:text-ink-soft transition-[color,background-color,border-color] duration-150 hover:border-ink-soft focus:border-accent"
          />
        </div>
        {value !== '' && (
          <button
            type="button"
            onClick={() => {
              onChange('')
              inputRef.current?.focus()
            }}
            className="shrink-0 rounded-control border border-line-strong bg-surface px-3 py-2 text-sm font-medium text-ink transition-colors duration-150 hover:bg-surface-soft hover:text-ink"
          >
            Effacer
          </button>
        )}
      </div>
      <p role="status" aria-live="polite" className="mt-1 min-h-5 text-xs text-ink-soft">
        {count}
      </p>
    </div>
  )
}
