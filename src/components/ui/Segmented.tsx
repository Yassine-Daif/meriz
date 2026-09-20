import { useId } from 'react'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

interface SegmentedProps<T extends string> {
  legend: string
  /** Libellé lu par les lecteurs d'écran seulement. */
  hideLegend?: boolean
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  size?: 'sm' | 'md'
}

/**
 * Choix unique en pilules. Ce sont de vrais boutons radio : flèches pour
 * changer, Tab pour sortir du groupe. Le choix actif est marqué par le
 * fond et par le poids du texte, pas par la couleur seule.
 */
export function Segmented<T extends string>({
  legend,
  hideLegend = false,
  options,
  value,
  onChange,
  size = 'md',
}: SegmentedProps<T>) {
  const name = useId()
  const pad = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm'

  return (
    <fieldset className="min-w-0">
      <legend className={hideLegend ? 'sr-only' : 'mb-1.5 text-sm font-medium text-ink'}>{legend}</legend>
      <div className="inline-flex flex-wrap gap-1 rounded-full border border-line-strong bg-surface p-1">
        {options.map((option) => {
          const checked = option.value === value
          return (
            <label
              key={option.value}
              className={`relative cursor-pointer rounded-full transition-colors duration-150 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus ${pad} ${
                checked
                  ? 'bg-accent font-semibold text-on-accent'
                  : 'font-medium text-ink-soft hover:bg-surface-soft hover:text-ink'
              }`}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
