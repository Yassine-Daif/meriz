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
  /** Vrai par défaut. */
  required?: boolean
  /** Zone de texte sur plusieurs lignes, avec un compteur si maxLength. */
  multiline?: boolean
  /** Police mono (codes, identifiants). */
  mono?: boolean
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
  required = true,
  multiline = false,
  mono = false,
  inputRef,
}: FormFieldProps) {
  const inputId = useId()
  const hintId = `${inputId}-aide`
  const errorId = `${inputId}-erreur`
  const counterId = `${inputId}-compteur`
  const showCounter = multiline && maxLength !== undefined
  const describedBy = [hint ? hintId : null, showCounter ? counterId : null, error ? errorId : null]
    .filter(Boolean)
    .join(' ')

  const fieldClass = `mt-1 w-full rounded-md border bg-surface px-3 py-2 text-sm ${mono ? 'font-mono tracking-wide' : ''} ${
    error ? 'border-rose-600' : 'border-zinc-300 hover:border-zinc-400'
  }`
  const shared = {
    id: inputId,
    value,
    required,
    minLength,
    maxLength,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy === '' ? undefined : describedBy,
    className: fieldClass,
  }

  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-medium text-ink">
        {label}
        {!required && <span className="ml-1 font-normal text-zinc-600">(facultatif)</span>}
      </label>
      {hint && (
        <p id={hintId} className="mt-0.5 text-xs text-zinc-600">
          {hint}
        </p>
      )}
      {multiline ? (
        <textarea
          {...shared}
          rows={3}
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          {...shared}
          ref={inputRef}
          type={type}
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {showCounter && (
        <p id={counterId} className="mt-0.5 text-right text-xs text-zinc-600">
          {value.length} / {maxLength}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-xs font-medium text-rose-700">
          <span aria-hidden="true">✕ </span>
          {error}
        </p>
      )}
    </div>
  )
}
