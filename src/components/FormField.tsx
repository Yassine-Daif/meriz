import { useId } from 'react'
import type { Ref } from 'react'

interface FormFieldProps {
  label: string
  type: 'text' | 'email' | 'password'
  value: string
  onChange: (value: string) => void
  autoComplete: string
  /** Erreur du champ, annoncée et liée au champ. */
  error?: string
  /** Aide permanente sous le libellé (ex. longueur minimale). */
  hint?: string
  minLength?: number
  maxLength?: number
  inputRef?: Ref<HTMLInputElement>
}

/**
 * Champ de formulaire accessible : libellé associé, aide et erreur
 * reliées par aria-describedby, état invalide signalé autrement que
 * par la couleur (symbole et texte).
 */
export function FormField({
  label,
  type,
  value,
  onChange,
  autoComplete,
  error,
  hint,
  minLength,
  maxLength,
  inputRef,
}: FormFieldProps) {
  const inputId = useId()
  const hintId = `${inputId}-aide`
  const errorId = `${inputId}-erreur`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ')

  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="mt-0.5 text-xs text-zinc-600">
          {hint}
        </p>
      )}
      <input
        id={inputId}
        ref={inputRef}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        required
        minLength={minLength}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy === '' ? undefined : describedBy}
        className={`mt-1 w-full rounded-md border bg-surface px-3 py-2 text-sm ${
          error ? 'border-rose-600' : 'border-zinc-300 hover:border-zinc-400'
        }`}
      />
      {error && (
        <p id={errorId} className="mt-1 text-xs font-medium text-rose-700">
          <span aria-hidden="true">✕ </span>
          {error}
        </p>
      )}
    </div>
  )
}
