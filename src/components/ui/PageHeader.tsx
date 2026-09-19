import type { ReactNode, Ref } from 'react'

interface PageHeaderProps {
  title: string
  /** Petit texte au-dessus du titre (ex. le rôle, le nom de la classe). */
  eyebrow?: string
  description?: ReactNode
  /** Actions principales de la page, alignées à droite sur grand écran. */
  actions?: ReactNode
  /** Le titre reçoit le focus à l'arrivée sur la page (tabIndex -1). */
  headingRef?: Ref<HTMLHeadingElement>
}

/** En-tête de page : le seul h1 de la page. */
export function PageHeader({ title, eyebrow, description, actions, headingRef }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="text-sm font-medium text-accent-ink">{eyebrow}</p>}
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          {title}
        </h1>
        {description && <div className="mt-1.5 max-w-2xl text-base leading-7 text-ink-soft">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
