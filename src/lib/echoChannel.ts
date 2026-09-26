import { getApiBaseUrl } from './apiConfig'
import { getEchoConfig } from './echoConfig'
import { readToken } from './tokenStorage'

/**
 * Le seul endroit qui connaît Laravel Echo. Il ouvre une connexion au
 * serveur de direct, s'abonne au canal privé d'un travail observé, et
 * rend de quoi tout refermer. Rien d'autre : la bascule entre direct et
 * rafraîchissement vit dans liveTransport.ts, sans dépendance à Echo.
 *
 * Les deux bibliothèques sont chargées à la demande : elles ne pèsent
 * sur le démarrage de personne, et surtout pas sur celui d'un élève.
 */

export type ChannelState = 'connecting' | 'live' | 'lost'

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

/** États du connecteur qui valent « le direct ne porte plus rien ». */
const LOST_STATES = new Set(['unavailable', 'failed', 'disconnected'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Le modèle porté par l'événement, ou null si la charge ne dit rien d'utile. */
export function readBroadcastContent(payload: unknown): string | null {
  return isRecord(payload) && typeof payload.content === 'string' ? payload.content : null
}

export const openEchoChannel: OpenChannel = ({ assignmentId, studentId, onContent, onState }) => {
  const config = getEchoConfig()
  const baseUrl = getApiBaseUrl()
  const token = readToken()
  let closed = false
  let teardown: (() => void) | null = null

  // Sans réglage, sans serveur ou sans jeton, il n'y a pas de direct à
  // tenter : on l'annonce perdu, le rafraîchissement prend le relais.
  if (config === null || baseUrl === null || token === null) {
    onState('lost')
    return { close: () => {} }
  }

  onState('connecting')

  void (async () => {
    try {
      const [{ default: Echo }, { default: Pusher }] = await Promise.all([
        import('laravel-echo'),
        import('pusher-js'),
      ])
      if (closed) {
        return
      }
      // Echo cherche le client Pusher sur window : c'est le branchement
      // prévu par la bibliothèque, et le seul global que l'on pose.
      ;(window as unknown as { Pusher?: unknown }).Pusher = Pusher

      const secure = config.scheme === 'https'
      const echo = new Echo({
        broadcaster: 'reverb',
        key: config.key,
        wsHost: config.host,
        wsPort: config.port,
        wssPort: config.port,
        forceTLS: secure,
        enabledTransports: secure ? ['wss'] : ['ws'],
        // L'autorisation des canaux vit hors de /api, sur l'origine du
        // serveur, et s'authentifie au jeton comme le reste.
        authEndpoint: `${baseUrl}/broadcasting/auth`,
        bearerToken: token,
      })

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
        echo.disconnect()
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
