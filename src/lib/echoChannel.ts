import { echoCredentials, isRecord, leaseEcho, LOST_STATES } from './echoClient'
import type { ChannelState } from './echoClient'

/**
 * Observation en direct : le canal privé d'un travail suivi. Il diffuse
 * l'instantané du modèle à chaque enregistrement de l'élève. La bascule
 * entre direct et rafraîchissement vit dans liveTransport.ts, sans
 * dépendance à Echo.
 */

export type { ChannelState } from './echoClient'

export interface ChannelHandle {
  close: () => void
}

export interface OpenChannelOptions {
  assignmentId: string
  studentId: number
  /** Le modèle reçu, tel quel. */
  onContent: (content: string) => void
  onState: (state: ChannelState) => void
}

export type OpenChannel = (options: OpenChannelOptions) => ChannelHandle

/** Nom du canal privé, tel que le serveur le déclare. */
export function channelName(assignmentId: string, studentId: number): string {
  return `assignments.${assignmentId}.work.${studentId}`
}

/** Le modèle porté par l'événement, ou null si la charge ne dit rien d'utile. */
export function readBroadcastContent(payload: unknown): string | null {
  return isRecord(payload) && typeof payload.content === 'string' ? payload.content : null
}

export const openEchoChannel: OpenChannel = ({ assignmentId, studentId, onContent, onState }) => {
  const credentials = echoCredentials()
  let closed = false
  let teardown: (() => void) | null = null

  // Sans réglage, sans serveur ou sans jeton, il n'y a pas de direct à
  // tenter : on l'annonce perdu, le rafraîchissement prend le relais.
  if (credentials === null) {
    onState('lost')
    return { close: () => {} }
  }

  onState('connecting')

  void (async () => {
    try {
      const { echo, release } = await leaseEcho(credentials)
      if (closed) {
        release()
        return
      }

      const name = channelName(assignmentId, studentId)
      const channel = echo.private(name)

      // Le nom de l'événement est personnalisé côté serveur, d'où le point.
      channel.listen('.work.updated', (payload: unknown) => {
        const content = readBroadcastContent(payload)
        if (content !== null) {
          onContent(content)
        }
      })
      channel.subscribed(() => onState('live'))
      channel.error(() => onState('lost'))

      const connection = echo.connector.pusher.connection
      const onStateChange = (change: unknown) => {
        const current = isRecord(change) ? change.current : null
        if (typeof current === 'string' && LOST_STATES.has(current)) {
          onState('lost')
        }
      }
      connection.bind('state_change', onStateChange)

      teardown = () => {
        connection.unbind('state_change', onStateChange)
        echo.leave(name)
        release()
      }
      if (closed) {
        teardown()
        teardown = null
      }
    } catch {
      // Bibliothèque introuvable, réglage refusé par le navigateur :
      // le direct n'aura pas lieu, et c'est tout ce qu'il faut savoir.
      if (!closed) {
        onState('lost')
      }
    }
  })()

  return {
    close: () => {
      closed = true
      teardown?.()
      teardown = null
    },
  }
}
