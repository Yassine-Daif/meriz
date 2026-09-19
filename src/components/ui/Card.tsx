import type { ReactNode } from 'react'

interface CardProps {
  /** Élément HTML porteur, pour garder une structure sémantique. */
  as?: 'div' | 'section' | 'article' | 'li'
  /** Fond plus discret, pour les cartes secondaires. */
  tone?: 'default' | 'soft'
  /** Légère levée au survol, pour une carte qui contient un lien ou un bouton principal. */
  lift?: boolean
  className?: string
  children: ReactNode
  'aria-labelledby'?: string
}

/** Carte arrondie, ombre douce teintée d'encre. */
export function Card({ as: Tag = 'div', tone = 'default', lift = false, className, children, ...aria }: CardProps) {
  const classes = [
    'rounded-card border border-line p-5 shadow-soft',
    tone === 'soft' ? 'bg-surface-soft' : 'bg-surface',
    lift ? 'transition duration-150 hover:shadow-lift motion-safe:hover:-translate-y-0.5' : '',
    className ?? '',
  ].join(' ')
  return (
    <Tag {...aria} className={classes}>
      {children}
    </Tag>
  )
}
