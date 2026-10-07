import type { ReactNode } from 'react'

/**
 * Détail replié : ce qu'il faut savoir sans l'avoir en pleine face.
 *
 * Le `<details>` natif fait tout le travail d'accessibilité : il
 * s'ouvre au clavier, et son état ouvert ou fermé est annoncé par le
 * navigateur, sans attribut à poser à la main.
 */
export function MoreInfo({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="mt-2 rounded-lg border border-line bg-shell/60 px-3 py-2 text-sm">
      <summary className="cursor-pointer text-xs font-medium text-ink-soft">{summary}</summary>
      <div className="mt-2 flex flex-col gap-2 text-sm leading-6 text-ink-soft">{children}</div>
    </details>
  )
}
