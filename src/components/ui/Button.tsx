import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { buttonClass } from './buttonClass'
import type { ButtonClassOptions } from './buttonClass'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonClassOptions {
  /** En cours : bouton inactif, annoncé occupé, avec un indicateur. */
  loading?: boolean
  /** Texte affiché pendant le chargement (ex. « Connexion… »). */
  loadingLabel?: string
  children: ReactNode
}

export function Button({
  variant,
  size,
  block,
  loading = false,
  loadingLabel,
  children,
  className,
  type = 'button',
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${buttonClass({ variant, size, block })} ${className ?? ''}`}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  )
}
