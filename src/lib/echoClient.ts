import { getApiBaseUrl } from './apiConfig'
import { getEchoConfig } from './echoConfig'
import { readToken } from './tokenStorage'

/**
 * Le montage de Laravel Echo, partagé par le direct d'observation et par
 * la co-édition. Les deux bibliothèques sont chargées à la demande :
 * elles ne pèsent sur le démarrage de personne.
 *
 * C'est le seul endroit, avec ses deux adaptateurs, qui connaît Echo.
 */

export type ChannelState = 'connecting' | 'live' | 'lost'

/** États du connecteur qui valent « le direct ne porte plus rien ». */
export const LOST_STATES = new Set(['unavailable', 'failed', 'disconnected'])

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Ce qu'il faut pour se connecter, ou null si quelque chose manque. */
export function echoCredentials(): { key: string; host: string; port: number; secure: boolean; authEndpoint: string; token: string } | null {
  const config = getEchoConfig()
  const baseUrl = getApiBaseUrl()
  const token = readToken()
  if (config === null || baseUrl === null || token === null) {
    return null
  }
  return {
    key: config.key,
    host: config.host,
    port: config.port,
    secure: config.scheme === 'https',
    // L'autorisation des canaux vit hors de /api, sur l'origine du
    // serveur, et s'authentifie au jeton comme le reste.
    authEndpoint: `${baseUrl}/broadcasting/auth`,
    token,
  }
}

/** Une connexion Echo neuve. Passe par `leaseEcho`, qui la partage. */
async function createEcho(credentials: NonNullable<ReturnType<typeof echoCredentials>>) {
  const [{ default: Echo }, { default: Pusher }] = await Promise.all([
    import('laravel-echo'),
    import('pusher-js'),
  ])
  // Echo cherche le client Pusher sur window : c'est le branchement
  // prévu par la bibliothèque, et le seul global que l'on pose.
  ;(window as unknown as { Pusher?: unknown }).Pusher = Pusher

  return new Echo({
    broadcaster: 'reverb',
    key: credentials.key,
    wsHost: credentials.host,
    wsPort: credentials.port,
    wssPort: credentials.port,
    forceTLS: credentials.secure,
    enabledTransports: credentials.secure ? ['wss'] : ['ws'],
    authEndpoint: credentials.authEndpoint,
    bearerToken: credentials.token,
  })
}

/* ------------------------------------------------------------------ */
/* Une seule connexion pour tout le direct                            */

type EchoInstance = Awaited<ReturnType<typeof createEcho>>

interface SharedEcho {
  /** Les réglages qui l'ont montée : un changement de compte la périme. */
  signature: string
  pending: Promise<EchoInstance>
  users: number
}

let shared: SharedEcho | null = null

export interface EchoLease {
  echo: EchoInstance
  /** Rend la connexion. La dernière main qui la quitte la ferme. */
  release: () => void
}

/**
 * La connexion du direct, partagée et comptée. Observation et
 * co-édition passent par la même : un prof qui regarde un travail et le
 * corrige à deux n'ouvre qu'un seul websocket, et il se ferme quand plus
 * personne ne s'en sert.
 */
export async function leaseEcho(
  credentials: NonNullable<ReturnType<typeof echoCredentials>>,
): Promise<EchoLease> {
  const signature = JSON.stringify(credentials)
  if (shared === null || shared.signature !== signature) {
    shared = { signature, pending: createEcho(credentials), users: 0 }
  }
  const entry = shared
  entry.users += 1

  let released = false
  const release = () => {
    if (released) {
      return
    }
    released = true
    entry.users -= 1
    if (entry.users > 0) {
      return
    }
    if (shared === entry) {
      shared = null
    }
    void entry.pending.then((echo) => echo.disconnect()).catch(() => {})
  }

  try {
    return { echo: await entry.pending, release }
  } catch (error) {
    release()
    throw error
  }
}
