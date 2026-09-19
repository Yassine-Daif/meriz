import { Badge } from './Badge'

interface ComingSoonProps {
  title: string
  description: string
  /** Niveau du titre, selon la page qui l'accueille. */
  headingLevel?: 'h2' | 'h3'
}

/**
 * Carte d'une section à venir : visible pour annoncer la suite, mais
 * rien de cliquable. « Bientôt » est écrit en toutes lettres.
 */
export function ComingSoon({ title, description, headingLevel: Heading = 'h3' }: ComingSoonProps) {
  return (
    <article className="rounded-card border border-dashed border-line-strong bg-surface-soft p-5">
      <div className="flex items-start justify-between gap-3">
        <Heading className="text-base font-semibold text-ink">{title}</Heading>
        <Badge tone="cherry">Bientôt</Badge>
      </div>
      <p className="mt-1.5 text-sm leading-6 text-ink-soft">{description}</p>
    </article>
  )
}
