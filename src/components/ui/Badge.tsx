import type { ReactNode } from 'react'

export type BadgeTone = 'neutral' | 'accent' | 'cherry' | 'apricot' | 'sage' | 'sky' | 'danger' | 'warning'

const TONES: Record<BadgeTone, string> = {
  neutral: 'border-line bg-surface-soft text-ink-soft',
  accent: 'border-transparent bg-accent-soft text-accent-ink',
  cherry: 'border-transparent bg-cherry-soft text-cherry',
  apricot: 'border-transparent bg-apricot-soft text-apricot',
  sage: 'border-transparent bg-sage-soft text-sage',
  sky: 'border-transparent bg-sky-soft text-sky',
  danger: 'border-transparent bg-danger-soft text-danger',
  warning: 'border-transparent bg-warning-soft text-warning',
}

interface BadgeProps {
  tone?: BadgeTone
  children: ReactNode
  className?: string
}

/**
 * Pastille de provenance ou d'état. Le texte porte toujours le sens :
 * la couleur n'est qu'un repère en plus.
 */
export function Badge({ tone = 'neutral', children, className }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${TONES[tone]} ${className ?? ''}`}
    >
      {children}
    </span>
  )
}
