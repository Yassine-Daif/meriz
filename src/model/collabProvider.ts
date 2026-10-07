import { applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness'
import { fromBase64, toBase64 } from '../lib/bytes'
import type { ModelSync } from './modelDoc'

/**
 * Co-édition : ce qui relie le document Yjs local à celui des autres.
 *
 * Le protocole tient en trois phrases. En arrivant, chacun annonce ce
 * qu'il a déjà, sous la forme d'un vecteur d'état ; qui reçoit un
 * vecteur répond avec ce qui manque, et rien de plus. Ensuite, chaque
 * écriture locale part telle quelle, et chaque écriture reçue s'applique
 * hors de l'historique : on n'annule jamais le geste d'un autre.
 *
 * Le transport est injecté, donc deux fournisseurs peuvent se parler
 * dans un essai, sans réseau ni navigateur.
 */

/** Identité d'affichage d'un participant, telle que le canal la porte. */
export interface CollabUser {
  id: number
  name: string
  firstName: string | null
  role: 'student' | 'teacher'
  avatarBg: string
  avatarFg: string
}

/** Position du pointeur, en coordonnées du modèle. */
export interface CollabCursor {
  x: number
  y: number
}

/** Ce qu'un participant montre de lui : où il est, ce qu'il a choisi. */
export interface CollabPresence {
  user: CollabUser
  cursor: CollabCursor | null
  /** Identifiants des nœuds et pattes sélectionnés. */
  selection: string[]
}

export interface RemotePresence extends CollabPresence {
  /** Identifiant Yjs de la connexion, unique par onglet. */
  clientId: number
}

export type CollabEvent = 'yjs-update' | 'awareness'

export interface CollabTransport {
  send: (event: CollabEvent, payload: unknown) => void
}

export interface CollabProviderOptions {
  sync: ModelSync
  transport: CollabTransport
  /** Qui je suis, publié dans la présence. */
  me: CollabUser
}

export interface CollabProvider {
  start: () => void
  stop: () => void
  /** Message venu du canal, à traiter. */
  receive: (event: string, payload: unknown) => void
  /** Un participant a quitté le canal : son curseur s'effface. */
  forget: (userId: number) => void
  /** Ma position et ma sélection, à publier. */
  publish: (presence: { cursor: CollabCursor | null; selection: string[] }) => void
  /** Les autres, à dessiner. */
  others: () => RemotePresence[]
  onPresence: (listener: () => void) => () => void
}

/** Origine des écritures de présence venues du réseau : on ne les renvoie pas. */
const REMOTE_PRESENCE = 'collab-remote'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Lecture prudente d'un message : le canal n'est pas une source sûre. */
function readText(payload: unknown, key: string): string | null {
  if (!isRecord(payload)) {
    return null
  }
  const value = payload[key]
  return typeof value === 'string' && value !== '' ? value : null
}

function readUser(raw: unknown): CollabUser | null {
  if (!isRecord(raw) || typeof raw.id !== 'number' || typeof raw.name !== 'string') {
    return null
  }
  if (raw.role !== 'student' && raw.role !== 'teacher') {
    return null
  }
  return {
    id: raw.id,
    name: raw.name,
    firstName: typeof raw.firstName === 'string' ? raw.firstName : null,
    role: raw.role,
    avatarBg: typeof raw.avatarBg === 'string' ? raw.avatarBg : '',
    avatarFg: typeof raw.avatarFg === 'string' ? raw.avatarFg : '',
  }
}

function readCursor(raw: unknown): CollabCursor | null {
  if (!isRecord(raw) || typeof raw.x !== 'number' || typeof raw.y !== 'number') {
    return null
  }
  return { x: raw.x, y: raw.y }
}

function readSelection(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : []
}

export function createCollabProvider({ sync, transport, me }: CollabProviderOptions): CollabProvider {
  const { awareness } = sync
  let running = false
  let stopUpdates: (() => void) | null = null
  const listeners = new Set<() => void>()

  const notify = () => {
    for (const listener of [...listeners]) {
      listener()
    }
  }

  /** Les états de présence changent : on redessine. */
  const onAwarenessChange = (
    changes: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => {
    if (running && origin !== REMOTE_PRESENCE) {
      // Ce qui vient de nous part sur le canal ; ce qui vient du réseau
      // est déjà connu de tout le monde.
      const touched = [...changes.added, ...changes.updated, ...changes.removed]
      transport.send('awareness', { update: toBase64(encodeAwarenessUpdate(awareness, touched)) })
    }
    notify()
  }

  return {
    start: () => {
      if (running) {
        return
      }
      running = true
      stopUpdates = sync.onLocalUpdate((update) => {
        transport.send('yjs-update', { kind: 'update', update: toBase64(update) })
      })
      awareness.on('update', onAwarenessChange)
      awareness.setLocalState({ user: me, cursor: null, selection: [] })
      // « Voilà ce que j'ai » : chacun répondra par ce qui me manque.
      transport.send('yjs-update', { kind: 'hello', vector: toBase64(sync.stateVector()) })
    },

    stop: () => {
      if (!running) {
        return
      }
      // On retire sa présence et on l'annonce tant que le canal est
      // encore ouvert, sinon on laisserait un curseur fantôme chez les
      // autres. L'ordre compte : couper d'abord, c'est se taire.
      awareness.setLocalState(null)
      running = false
      stopUpdates?.()
      stopUpdates = null
      awareness.off('update', onAwarenessChange)
      notify()
    },

    receive: (event, payload) => {
      if (!running) {
        return
      }
      if (event === 'yjs-update') {
        const update = readText(payload, 'update')
        if (update !== null) {
          sync.applyRemote(fromBase64(update))
        }
        const vector = readText(payload, 'vector')
        if (vector === null) {
          return
        }
        /*
         * Un vecteur nous dit ce que l'autre a déjà : on lui envoie ce
         * qui lui manque. Et comme nous pouvons manquer de son côté,
         * notre réponse porte notre propre vecteur, pour qu'il nous
         * complète à son tour. « hello » demande une réponse, une
         * réponse n'en demande pas d'autre : la poignée s'arrête là.
         *
         * Sans cela, un pair qui a parlé dans le vide avant l'arrivée de
         * l'autre resterait incomplet, et plus rien de ce que l'autre
         * écrit ne pourrait s'intégrer chez lui.
         */
        const answering = readText(payload, 'kind') === 'answer'
        transport.send('yjs-update', {
          kind: answering ? 'update' : 'answer',
          ...(answering ? {} : { vector: toBase64(sync.stateVector()) }),
          update: toBase64(sync.diffSince(fromBase64(vector))),
        })
        if (!answering && awareness.getLocalState() !== null) {
          // L'arrivant ne sait pas encore qui est là : on se présente à
          // nouveau, sinon le premier entré resterait invisible.
          transport.send('awareness', {
            update: toBase64(encodeAwarenessUpdate(awareness, [awareness.clientID])),
          })
        }
        return
      }
      if (event === 'awareness') {
        const update = readText(payload, 'update')
        if (update !== null) {
          applyAwarenessUpdate(awareness, fromBase64(update), REMOTE_PRESENCE)
        }
      }
    },

    forget: (userId) => {
      const gone: number[] = []
      for (const [clientId, raw] of awareness.getStates()) {
        const user = isRecord(raw) ? readUser(raw.user) : null
        if (user && user.id === userId && clientId !== awareness.clientID) {
          gone.push(clientId)
        }
      }
      if (gone.length > 0) {
        removeAwarenessStates(awareness, gone, REMOTE_PRESENCE)
      }
    },

    publish: ({ cursor, selection }) => {
      if (running) {
        awareness.setLocalState({ user: me, cursor, selection })
      }
    },

    others: () => {
      const presences: RemotePresence[] = []
      for (const [clientId, raw] of awareness.getStates()) {
        if (clientId === awareness.clientID || !isRecord(raw)) {
          continue
        }
        const user = readUser(raw.user)
        if (user) {
          presences.push({
            clientId,
            user,
            cursor: readCursor(raw.cursor),
            selection: readSelection(raw.selection),
          })
        }
      }
      return presences
    },

    onPresence: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
