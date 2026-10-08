import { ViewportPortal } from '@xyflow/react'
import type { RemotePresence } from '../model/collabProvider'

/**
 * Les liaisons que les autres sont en train de tirer, dessinées dans le
 * repère du modèle : elles suivent donc le zoom et le cadrage sans calcul
 * maison, comme les curseurs.
 *
 * Le trait part du bloc et va jusqu'au curseur de celui qui tire. Il est
 * tireté, parce que ce n'est pas encore une patte : rien n'est écrit dans
 * le modèle tant que la personne n'a pas lâché. Il porte la couleur de
 * son auteur, pour qu'on sache qui fait quoi à plusieurs.
 *
 * Sans curseur il n'y a rien à suivre : un participant qui sort de la
 * zone de dessin en plein tracé voit son trait disparaître chez les
 * autres, et réapparaître dès qu'il revient.
 */
export function RemoteDraftLinks({ others }: { others: RemotePresence[] }) {
  const drafts = others.flatMap((other) =>
    other.draft === null || other.cursor === null
      ? []
      : [
          {
            clientId: other.clientId,
            from: other.draft.from,
            to: other.cursor,
            color: other.user.avatarBg,
          },
        ],
  )
  if (drafts.length === 0) {
    return null
  }

  return (
    <ViewportPortal>
      {/*
       * Un seul calque posé à l'origine du modèle. Il déborde, pour
       * accepter les coordonnées négatives, et reste sous les curseurs.
       */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute overflow-visible"
        style={{ left: 0, top: 0, width: 1, height: 1, zIndex: 999 }}
      >
        {drafts.map((draft) => (
          <line
            key={draft.clientId}
            x1={draft.from.x}
            y1={draft.from.y}
            x2={draft.to.x}
            y2={draft.to.y}
            stroke={draft.color}
            strokeWidth={2}
            strokeDasharray="6 4"
            strokeLinecap="round"
          />
        ))}
      </svg>
    </ViewportPortal>
  )
}
