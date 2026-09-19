import { useId } from 'react'

interface ToggleSwitchProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  /** Précision sous le libellé, reliée à l'interrupteur. */
  description?: string
}

/**
 * Interrupteur accessible (role="switch") : libellé visible, état
 * annoncé, et l'état écrit en toutes lettres (Oui / Non), jamais
 * porté par la seule couleur.
 */
export function ToggleSwitch({ label, checked, onChange, description }: ToggleSwitchProps) {
  const labelId = useId()
  const descriptionId = useId()

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p id={labelId} className="text-sm font-medium text-ink">
          {label}
        </p>
        {description && (
          <p id={descriptionId} className="text-xs text-zinc-600">
            {description}
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={description ? descriptionId : undefined}
        onClick={() => onChange(!checked)}
        className={`flex shrink-0 items-center gap-2 rounded-full border px-1 py-1 pr-3 text-xs font-medium ${
          checked
            ? 'border-indigo-700 bg-indigo-700 text-white hover:bg-indigo-800 hover:text-white'
            : 'border-zinc-300 bg-surface text-ink hover:bg-shell'
        }`}
      >
        <span
          aria-hidden="true"
          className={`h-4 w-4 rounded-full ${checked ? 'bg-white' : 'bg-zinc-400'}`}
        />
        {checked ? 'Oui' : 'Non'}
      </button>
    </div>
  )
}
