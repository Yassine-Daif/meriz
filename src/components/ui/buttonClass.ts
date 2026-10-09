export type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonClassOptions {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Pleine largeur. */
  block?: boolean
}

/**
 * Chaque survol garde le même couple texte et fond, ou un couple vérifié
 * par le test de contraste : jamais de texte illisible au passage.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'border-accent bg-accent text-on-accent shadow-soft hover:border-accent-hover hover:bg-accent-hover hover:text-on-accent hover:shadow-lift',
  secondary:
    'border-line-strong bg-surface text-ink shadow-soft hover:border-ink-soft hover:bg-surface-soft hover:text-ink',
  soft: 'border-transparent bg-accent-soft text-accent-ink hover:border-mark hover:text-accent-ink',
  ghost: 'border-transparent bg-transparent text-accent-ink hover:bg-accent-soft hover:text-accent-ink',
  danger:
    'border-danger-strong bg-danger-strong text-on-accent shadow-soft hover:brightness-90 hover:text-on-accent hover:shadow-lift',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-8 gap-1.5 px-3 py-1 text-xs',
  md: 'min-h-10 gap-2 px-4 py-2 text-sm',
  lg: 'min-h-12 gap-2 px-5 py-2.5 text-base',
}

/**
 * Classes d'un bouton, aussi pour un lien qui en a l'allure.
 *
 * La transition couvre l'ombre en plus des couleurs, et le bouton
 * s'enfonce d'un pixel au clic : le geste se sent. L'enfoncement est sous
 * motion-safe, donc il disparaît quand le système demande moins de
 * mouvement.
 */
export function buttonClass({ variant = 'secondary', size = 'md', block = false }: ButtonClassOptions = {}): string {
  return [
    'inline-flex items-center justify-center rounded-control border font-medium',
    'transition-[color,background-color,border-color,box-shadow,transform] duration-150',
    'motion-safe:active:translate-y-px',
    'disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none',
    VARIANTS[variant],
    SIZES[size],
    block ? 'w-full' : '',
  ].join(' ')
}
