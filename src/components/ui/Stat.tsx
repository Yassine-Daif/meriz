interface StatProps {
  /** Le nombre, ou « … » tant qu'il n'est pas connu. */
  value: string
  /** Ce qu'il compte, en toutes lettres et accordé. */
  label: string
}

/** Un chiffre de la bande d'un tableau de bord : le nombre, puis son sens. */
export function Stat({ value, label }: StatProps) {
  return (
    <div className="rounded-card border border-line bg-surface p-5 shadow-soft">
      <p className="text-3xl font-semibold tracking-tight text-ink">{value}</p>
      <p className="mt-0.5 text-sm text-ink-soft">{label}</p>
    </div>
  )
}
