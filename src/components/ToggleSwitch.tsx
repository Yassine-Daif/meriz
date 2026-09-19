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
          <p id={descriptionId} className="text-xs text-ink-soft">
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
        className={`flex min-h-8 shrink-0 items-center gap-2 rounded-full border px-1 py-1 pr-3 text-xs font-medium transition-colors duration-150 ${
          checked
            ? 'border-accent bg-accent text-on-accent hover:border-accent-hover hover:bg-accent-hover hover:text-on-accent'
            : 'border-line-strong bg-surface text-ink hover:bg-surface-soft hover:text-ink'
        }`}
      >
        <span
          aria-hidden="true"
          className={`h-5 w-5 rounded-full ${checked ? 'bg-on-accent' : 'bg-line-strong'}`}
        />
        {checked ? 'Oui' : 'Non'}
      </button>
    </div>
  )
}
