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
 *
 * La flèche est une goutte aux angles arrondis, pas un triangle de
 * système, et le nom se pose dans une pastille. Un liseré clair fait
 * tenir les deux sur n'importe quel fond de schéma, du bloc teinté
 * d'accent au papier de la zone de dessin.
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
            <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" className="drop-shadow-sm">
              <path
                d="M3.6 2.6a1.5 1.5 0 0 1 2-.6l12 7a1.5 1.5 0 0 1-.2 2.7l-4.6 1.6a1.5 1.5 0 0 0-.9.9l-1.6 4.6a1.5 1.5 0 0 1-2.7.2l-4.6-12a1.5 1.5 0 0 1 .6-2z"
                fill={other.user.avatarBg}
                stroke={other.user.avatarFg}
                strokeWidth="1.3"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
            <span
              style={{ backgroundColor: other.user.avatarBg, color: other.user.avatarFg }}
              className="-mt-0.5 ml-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ring-2 ring-surface shadow-soft"
            >
              {name}
              {teacher && <span className="text-[0.65rem] font-bold tracking-wide uppercase opacity-80">prof</span>}
            </span>
          </div>
        )
      })}
    </ViewportPortal>
  )
}
