import { useId } from 'react'
import type { Ref } from 'react'

interface FormFieldProps {
  label: string
  type: 'text' | 'email' | 'password' | 'url'
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
  /** Hauteur de la zone de texte, en lignes. */
  rows?: number
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
  rows = 3,
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

  const fieldClass = `mt-1.5 w-full rounded-control border bg-surface px-3.5 py-2.5 text-sm text-ink transition-colors duration-150 ${mono ? 'font-mono tracking-wide' : ''} ${
    error ? 'border-2 border-danger' : 'border-line-strong hover:border-ink-soft'
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
        {!required && <span className="ml-1 font-normal text-ink-soft">(facultatif)</span>}
      </label>
      {hint && (
        <p id={hintId} className="mt-0.5 text-xs text-ink-soft">
          {hint}
        </p>
      )}
      {multiline ? (
        <textarea
          {...shared}
          rows={rows}
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
        <p id={counterId} className="mt-1 text-right text-xs text-ink-soft">
          {value.length} / {maxLength}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1.5 text-xs font-medium text-danger">
          <span aria-hidden="true">✕ </span>
          {error}
        </p>
      )}
    </div>
  )
}
