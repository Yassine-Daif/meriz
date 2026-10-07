import { displayName } from '../lib/authApi'
import type { CollabUser, RemotePresence } from '../model/collabProvider'
import type { ChannelState } from '../lib/echoClient'
import type { CollabRole } from './useCollaboration'
import { Avatar } from './ui/Avatar'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'

/**
 * Bande de co-édition, sous la barre d'outils du MCD. Elle dit qui est
 * là, et ce que cela change. Jamais d'intervention invisible : quand le
 * prof est dans le canal, l'élève le lit en toutes lettres. Entre pairs
 * d'un groupe, on se nomme simplement.
 */
interface CollaborationBannerProps {
  state: ChannelState | 'off'
  /** « observe » : on lit un travail suivi, sans canal ni présence. */
  mode: 'observe' | 'edit'
  /** Les autres présents, sans moi. */
  participants: CollabUser[]
  /** Ceux qui éditent vraiment : ils publient un curseur. */
  others: RemotePresence[]
  /** Ma place sur ce document. */
  role: CollabRole
  /** Passer de l'observation à la correction à deux. */
  onStart?: () => void
}

export function CollaborationBanner({
  state,
  mode,
  participants,
  others,
  role,
  onStart,
}: CollaborationBannerProps) {
  const live = state === 'live'
  const guest = role === 'guest'
  const member = role === 'member'
  const names = participants.map((person) => displayName(person) || 'Participant').join(', ')
  const editing = new Set(others.map((other) => other.user.id))

  /* -------- Le prof lit : on lui propose de corriger à deux -------- */
  if (mode === 'observe') {
    // Rien d'annoncé : la bande est là dès l'ouverture de la vue, elle
    // informe le prof de sa propre position, elle ne prévient de rien.
    return (
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-soft px-4 py-2 text-sm text-ink-soft">
        <span>
          Vous lisez ce travail en lecture seule. Votre élève voit que ce devoir peut être suivi, et la date de
          votre dernière lecture.
        </span>
        {onStart && (
          <Button size="sm" variant="primary" onClick={onStart} aria-label="Corriger en direct ce travail">
            Corriger en direct
          </Button>
        )}
      </div>
    )
  }

  /* -------- Document d'un groupe, entre pairs -------- */
  if (member) {
    if (!live) {
      /*
       * Le membre n'est pas bloqué : ce document est aussi le sien, il
       * continue d'écrire et la fusion se fera au retour du lien.
       */
      return (
        <p role="status" className="border-b border-line bg-surface-soft px-4 py-2 text-sm text-ink-soft">
          Lien avec le groupe interrompu. Continuez à travailler : vos modifications rejoindront celles du groupe
          au retour de la connexion.
        </p>
      )
    }
    if (participants.length === 0) {
      return (
        <p className="border-b border-line bg-surface-soft px-4 py-2 text-sm text-ink-soft">
          Vous êtes seul sur ce document du groupe. Les autres membres peuvent l’ouvrir en même temps que vous.
        </p>
      )
    }
    return (
      <div
        role="status"
        className="flex flex-wrap items-center gap-2 border-b border-line bg-accent-soft px-4 py-2 text-sm text-accent-ink"
      >
        {participants.map((person) => (
          <Avatar key={person.id} person={person} size="sm" labelled />
        ))}
        <span>
          <strong className="font-semibold">{names}</strong>
          {participants.length > 1 ? ' travaillent' : ' travaille'} avec vous sur ce document du groupe.
        </span>
      </div>
    )
  }

  /* -------- Correction à deux, prof et élève -------- */

  // L'invité a besoin de savoir si son lien tient : sans lui, ses
  // modifications n'iraient nulle part.
  if (guest && !live) {
    return (
      <p role="status" className="border-b border-line bg-warning-soft px-4 py-2 text-sm text-ink">
        Lien de co-édition interrompu. Vous suivez le travail sans pouvoir le modifier, le temps que la
        connexion revienne.
      </p>
    )
  }

  if (guest && participants.length === 0) {
    return (
      <p role="status" className="border-b border-line bg-surface-soft px-4 py-2 text-sm text-ink-soft">
        En attente de l’élève. Il faut qu’il soit sur son travail pour corriger à deux, puisque c’est lui qui
        l’enregistre.
      </p>
    )
  }

  const teacher = participants.find((person) => person.role === 'teacher')

  /*
   * L'élève sur son travail suivi, personne avec lui. Discret mais
   * jamais secret : la ligne reste là tout du long, sans annonce ni
   * couleur d'alerte. Un prof présent dans ce canal corrige forcément,
   * et cela se lit alors en toutes lettres.
   */
  if (role === 'owner' && teacher === undefined) {
    return (
      <p className="border-b border-line bg-surface-soft px-4 py-2 text-sm text-ink-soft">
        Votre prof peut suivre cet exercice. Il voit votre modèle tel que vous l’enregistrez, et la date de sa
        lecture vous est donnée dans le devoir.
      </p>
    )
  }

  if (!live || participants.length === 0) {
    return null
  }

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-2 border-b border-line bg-accent-soft px-4 py-2 text-sm text-accent-ink"
    >
      {participants.map((person) => (
        <Avatar key={person.id} person={person} size="sm" labelled />
      ))}
      {guest ? (
        <span>
          Vous corrigez avec <strong className="font-semibold">{names}</strong>. Vos modifications arrivent
          chez elle ou lui tout de suite, et c’est son travail qui s’enregistre.
        </span>
      ) : teacher ? (
        <span>
          <strong className="font-semibold">Votre prof corrige avec vous.</strong> Vous travaillez tous les
          deux sur ce modèle
          {editing.has(teacher.id) ? ', et vous voyez son curseur à l’écran' : ''}.
        </span>
      ) : (
        <span>
          <strong className="font-semibold">{names}</strong> travaille avec vous sur ce modèle.
        </span>
      )}
      {teacher && !guest && <Badge tone="accent">Prof présent</Badge>}
    </div>
  )
}
