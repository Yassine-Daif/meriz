import { ViewportPortal } from '@xyflow/react'
import type { RemotePresence } from '../model/collabProvider'

/**
 * Le crayon rouge du prof, dessiné dans le repère du modèle : le trait
 * suit donc le zoom et le cadrage sans calcul maison, comme les curseurs.
 *
 * C'est un geste de monstration, pas une information : rien ne s'écrit
 * dans le modèle, rien ne s'enregistre, et le trait disparaît dès que le
 * prof lâche le bouton. Seul un pair enseignant peut en tracer un, et ce
 * filtre-ci est la dernière des quatre barrières.
 */
export function RemoteInk({ others }: { others: RemotePresence[] }) {
  const traces = others.flatMap((other) =>
    other.ink === null || other.user.role !== 'teacher'
      ? []
      : [{ clientId: other.clientId, points: other.ink.points }],
  )
  if (traces.length === 0) {
    return null
  }

  return (
    <ViewportPortal>
      {/*
       * Un seul calque posé à l'origine du modèle. Il déborde, pour
       * accepter les coordonnées négatives, et reste sous les tracés de
       * liaison et les curseurs : un trait de craie passe derrière.
       */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute overflow-visible"
        style={{ left: 0, top: 0, width: 1, height: 1, zIndex: 998 }}
      >
        {traces.map((trace) => (
          <polyline
            key={trace.clientId}
            points={trace.points.map((point) => `${point.x},${point.y}`).join(' ')}
            fill="none"
            /* Le rouge du crayon du prof, pas un état d'erreur. On réutilise
               le jeton plutôt que d'en inventer un pour un seul usage. */
            stroke="var(--c-danger-strong)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
    </ViewportPortal>
  )
}
