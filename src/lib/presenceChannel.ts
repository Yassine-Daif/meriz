import { echoCredentials, isRecord, leaseEcho, LOST_STATES } from './echoClient'
import type { ChannelState } from './echoClient'
import type { CollabEvent, CollabUser } from '../model/collabProvider'

/**
 * Co-édition : le canal de présence d'un document. Il porte l'identité
 * d'affichage de ceux qui sont là, et laisse passer de pair à pair les
 * mises à jour Yjs et les curseurs, sans que le serveur les lise.
 *
 * Les évènements de client s'appellent `client-yjs-update` et
 * `client-awareness` sur le fil ; Echo pose lui-même le préfixe.
 */

export interface PresenceHandle {
  send: (event: CollabEvent, payload: unknown) => void
  close: () => void
}

export interface OpenPresenceOptions {
  documentId: string
  /** Qui est déjà là à l'arrivée. */
  onHere: (members: CollabUser[]) => void
  onJoin: (member: CollabUser) => void
  onLeave: (member: CollabUser) => void
  onMessage: (event: CollabEvent, payload: unknown) => void
  onState: (state: ChannelState) => void
}

export type OpenPresence = (options: OpenPresenceOptions) => PresenceHandle

/** Nom du canal, tel que le serveur le déclare. Echo ajoute « presence- ». */
export function presenceName(documentId: string): string {
  return `documents.${documentId}`
}

/**
 * L'identité telle que le serveur la met dans la présence, en
 * serpentin. Une charge qui ne dit pas qui elle est n'est pas affichée.
 */
export function readMember(raw: unknown): CollabUser | null {
  if (!isRecord(raw) || typeof raw.id !== 'number' || typeof raw.name !== 'string') {
    return null
  }
  if (raw.role !== 'student' && raw.role !== 'teacher') {
    return null
  }
  return {
    id: raw.id,
    name: raw.name,
    firstName: typeof raw.first_name === 'string' ? raw.first_name : null,
    role: raw.role,
    avatarBg: typeof raw.avatar_bg === 'string' ? raw.avatar_bg : '',
    avatarFg: typeof raw.avatar_fg === 'string' ? raw.avatar_fg : '',
  }
}

function readMembers(raw: unknown): CollabUser[] {
  if (!Array.isArray(raw)) {
    return []
  }
  const members: CollabUser[] = []
  for (const item of raw) {
    const member = readMember(item)
    if (member) {
      members.push(member)
    }
  }
  return members
}

export const openPresenceChannel: OpenPresence = ({
  documentId,
  onHere,
  onJoin,
  onLeave,
  onMessage,
  onState,
}) => {
  const credentials = echoCredentials()
  let closed = false
  let teardown: (() => void) | null = null
  let whisper: ((event: CollabEvent, payload: unknown) => void) | null = null

  if (credentials === null) {
    onState('lost')
    return { send: () => {}, close: () => {} }
  }

  onState('connecting')

  void (async () => {
    try {
      const { echo, release } = await leaseEcho(credentials)
      if (closed) {
        release()
        return
      }

      const name = presenceName(documentId)
      const channel = echo.join(name)

      channel
        .here((members: unknown) => {
          onHere(readMembers(members))
          onState('live')
        })
        .joining((member: unknown) => {
          const joined = readMember(member)
          if (joined) {
            onJoin(joined)
          }
        })
        .leaving((member: unknown) => {
          const left = readMember(member)
          if (left) {
            onLeave(left)
          }
        })
        .error(() => onState('lost'))

      channel.listenForWhisper('yjs-update', (payload: unknown) => onMessage('yjs-update', payload))
      channel.listenForWhisper('awareness', (payload: unknown) => onMessage('awareness', payload))

      // Les charges envoyées sont toujours des objets : le fournisseur
      // n'émet que { kind, vector } ou { update }.
      whisper = (event, payload) => channel.whisper(event, payload as Record<string, unknown>)

      const connection = echo.connector.pusher.connection
      const onStateChange = (change: unknown) => {
        const current = isRecord(change) ? change.current : null
        if (typeof current !== 'string') {
          return
        }
        if (LOST_STATES.has(current)) {
          onState('lost')
          return
        }
        /*
         * Le connecteur se rebranche : le canal ne porte plus rien tant
         * que l'abonnement n'est pas revenu. En co-édition cela compte,
         * une modification envoyée à ce moment n'arriverait nulle part.
         */
        if (current === 'connecting') {
          onState('connecting')
        }
      }
      connection.bind('state_change', onStateChange)

      teardown = () => {
        whisper = null
        connection.unbind('state_change', onStateChange)
        echo.leave(name)
        release()
      }
      if (closed) {
        teardown()
        teardown = null
      }
    } catch {
      // Bibliothèque introuvable, réglage refusé : pas de co-édition,
      // et c'est tout ce qu'il faut savoir.
      if (!closed) {
        onState('lost')
      }
    }
  })()

  return {
    send: (event, payload) => {
      whisper?.(event, payload)
    },
    close: () => {
      closed = true
      teardown?.()
      teardown = null
    },
  }
}
