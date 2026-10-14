import { useId } from 'react'
import type { ReactNode } from 'react'
import { Card } from './Card'

interface FormSectionProps {
  title: string
  /** Une phrase sous le titre, qui dit à quoi sert la section. */
  description?: ReactNode
  /**
   * Niveau du titre. Il suit la profondeur de la page, il ne se choisit
   * pas au hasard : sous un h2 de page on met h3, sous un h3 on met h4.
   */
  level?: 'h2' | 'h3' | 'h4'
  /** Boutons posés à droite du titre, sur la même ligne. */
  actions?: ReactNode
  /** Fond discret, pour une section secondaire. */
  tone?: 'default' | 'soft'
  className?: string
  children: ReactNode
}

/**
 * Une section d'un écran de création : un titre, une phrase, et son
 * contenu, dans une carte au dessin commun.
 *
 * Le titre est relié à la section par un identifiant engendré ici. C'est
 * tout l'intérêt de la brique : écrite à la main, la relation s'oublie,
 * ou pire, l'identifiant est mis en dur et deux sections finissent par
 * porter le même.
 */
export function FormSection({
  title,
  description,
  level = 'h3',
  actions,
  tone = 'default',
  className,
  children,
}: FormSectionProps) {
  const titleId = useId()
  const Heading = level

  return (
    <Card as="section" tone={tone} aria-labelledby={titleId} className={className}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Heading id={titleId} className="text-base font-semibold text-ink">
            {title}
          </Heading>
          {description !== undefined && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
        </div>
        {actions !== undefined && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  )
}
