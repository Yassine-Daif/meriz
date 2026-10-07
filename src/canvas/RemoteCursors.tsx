import { ViewportPortal } from '@xyflow/react'
import { displayName } from '../lib/authApi'
import type { RemotePresence } from '../model/collabProvider'

/**
 * Les curseurs des autres participants, dessinés dans le repère du
 * modèle : ils suivent donc le zoom et le cadrage sans calcul maison.
 *
 * Chacun porte ses couleurs de profil et son nom. La mention « prof »
 * s'ajoute quand c'est l'enseignant qui corrige avec un élève : le
 * texte dit toujours qui est là, la couleur n'est qu'un repère en plus.
 * Entre pairs d'un groupe, personne n'est prof de personne, donc on
 * affiche seulement les noms.
 */
export function RemoteCursors({
  others,
  teacherTag = true,
}: {
  others: RemotePresence[]
  /** Faux entre pairs d'un groupe. */
  teacherTag?: boolean
}) {
  const visible = others.filter((other) => other.cursor !== null)
  if (visible.length === 0) {
    return null
  }

  return (
    <ViewportPortal>
      {visible.map((other) => {
        const name = displayName(other.user) || 'Participant'
        const teacher = teacherTag && other.user.role === 'teacher'
        return (
          <div
            key={other.clientId}
            aria-hidden="true"
            className="pointer-events-none absolute"
            style={{
              transform: `translate(${other.cursor!.x}px, ${other.cursor!.y}px)`,
              // Au-dessus des nœuds, jamais dans leur chemin.
              zIndex: 1000,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path
                d="M2 2l6.5 14 2.2-5.4L16 8.6z"
                fill={other.user.avatarBg}
                stroke={other.user.avatarFg}
                strokeWidth="1.2"
              />
            </svg>
            <span
              style={{ backgroundColor: other.user.avatarBg, color: other.user.avatarFg }}
              className="mt-0.5 inline-flex items-center gap-1 rounded-control px-1.5 py-0.5 text-xs font-medium whitespace-nowrap shadow-soft"
            >
              {name}
              {teacher && <span className="font-semibold uppercase">prof</span>}
            </span>
          </div>
        )
      })}
    </ViewportPortal>
  )
}
