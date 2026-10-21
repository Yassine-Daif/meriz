import { applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness'
import { fromBase64, toBase64 } from '../lib/bytes'
import { INK_MAX_POINTS } from './inkTrace'
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

/**
 * Liaison en cours de tracé : d'où part le trait qu'un participant est en
 * train de tirer. Son arrivée, c'est son curseur, déjà publié.
 */
export interface CollabDraftLink {
  /** Ancrage sur le bloc de départ, en coordonnées du modèle. */
  from: CollabCursor
}

/**
 * Trait de crayon éphémère : une polyligne en coordonnées du modèle.
 * Il ne passe jamais par le modèle, ne s'enregistre jamais, et ne vit que
 * le temps d'une pression. Null : personne ne dessine.
 */
export interface CollabInk {
  points: CollabCursor[]
  strokes?: { id: string; points: CollabCursor[]; expiresAt: number }[]
}

/** Rectangle de sélection en coordonnées du modèle, uniquement dans la présence. */
export interface CollabSelectionBox extends CollabCursor {
  width: number
  height: number
}

/** Ce qu'un participant montre de lui : où il est, ce qu'il a choisi. */
export type CollabView = 'dictionnaire' | 'mcd' | 'mld' | 'mpd' | 'sql' | 'code'

export interface CollabPresence {
  view?: CollabView | null
  user: CollabUser
  cursor: CollabCursor | null
  /** Identifiants des nœuds et pattes sélectionnés. */
  selection: string[]
  selectionBox?: CollabSelectionBox | null
  /**
   * Liaison en cours, éphémère. Elle ne passe jamais par le modèle :
   * c'est de l'affichage, comme un curseur. Null : personne ne tire rien.
   */
  draft: CollabDraftLink | null
  /** Trait de crayon en cours, éphémère lui aussi. */
  ink: CollabInk | null
}

export interface RemotePresence extends CollabPresence {
  /** Identifiant Yjs de la connexion, unique par onglet. */
  clientId: number
}

export type CollabEvent = 'yjs-update' | 'awareness' | 'comments-changed'

export interface CollabTransport {
  send: (event: CollabEvent, payload: unknown) => void
}

export interface CollabProviderOptions {
  sync: ModelSync
  transport: CollabTransport
  /** Qui je suis, publié dans la présence. */
  me: CollabUser
  /** Observation : réception seule, aucune présence ni écriture diffusée. */
  readOnly?: boolean
}

export interface CollabProvider {
  isSynced: () => boolean
  start: () => void
  stop: () => void
  /** Message venu du canal, à traiter. */
  receive: (event: string, payload: unknown) => void
  /** Un participant a quitté le canal : son curseur s'effface. */
  forget: (userId: number) => void
  /** Ma position, ma sélection et mon tracé en cours, à publier. */
  publish: (presence: {
    cursor: CollabCursor | null
    selection: string[]
    selectionBox?: CollabSelectionBox | null
    view?: CollabView | null
    draft?: CollabDraftLink | null
    ink?: CollabInk | null
  }) => void
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

export function readSelectionBox(raw: unknown): CollabSelectionBox | null {
  if (!isRecord(raw)) return null
  const { x, y, width, height } = raw
  if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number' || typeof height !== 'number'
    || ![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0
    || Math.abs(x) > 1e9 || Math.abs(y) > 1e9 || width > 1e7 || height > 1e7) return null
  return { x, y, width, height }
}

function readDraft(raw: unknown): CollabDraftLink | null {
  if (!isRecord(raw)) {
    return null
  }
  const from = readCursor(raw.from)
  return from === null ? null : { from }
}

/**
 * Un trait venu du réseau. Trois refus : ce qui n'est pas un tableau de
 * points, un trait démesuré (un pair bavard ne fera pas ramer le rendu),
 * et un point illisible, qui invalide tout le trait. Un point seul ne
 * dessine rien.
 */
function readInk(raw: unknown): CollabInk | null {
  if (!isRecord(raw) || !Array.isArray(raw.points) || raw.points.length > INK_MAX_POINTS) {
    return null
  }
  const points: CollabCursor[] = []
  for (const item of raw.points) {
    const point = readCursor(item)
    if (point === null) {
      return null
    }
    points.push(point)
  }
  const strokes = (Array.isArray(raw.strokes) ? raw.strokes.slice(0, 3) : []).flatMap((stroke) => {
    if (!isRecord(stroke) || typeof stroke.id !== 'string' || stroke.id.length > 100
      || typeof stroke.expiresAt !== 'number' || !Number.isFinite(stroke.expiresAt)
      || stroke.expiresAt <= Date.now() || stroke.expiresAt > Date.now() + 60_000) return []
    const parsed = readInk({ points: stroke.points })
    return parsed ? [{ id: stroke.id, points: parsed.points, expiresAt: stroke.expiresAt }] : []
  })
  return points.length < 2 && strokes.length === 0 ? null : { points, ...(strokes.length ? { strokes } : {}) }
}

function readSelection(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : []
}

/** Un professeur silencieux n'annonce aucune awareness. Dans un groupe,
 * l'appartenance au canal suffit toujours : tous les pairs restent visibles. */
export function visibleCollaborators(participants: CollabUser[], others: RemotePresence[], group: boolean): CollabUser[] {
  return participants.filter((person) =>
    group || person.role !== 'teacher' || others.some((other) => other.user.id === person.id),
  )
}

export function readCollabView(raw: unknown): CollabView | null {
  return raw === 'dictionnaire' || raw === 'mcd' || raw === 'mld' || raw === 'mpd' || raw === 'sql' || raw === 'code' ? raw : null
}

export function createCollabProvider({ sync, transport, me, readOnly = false }: CollabProviderOptions): CollabProvider {
  const { awareness } = sync
  let running = false
  let synced = false
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
    if (running && !readOnly && origin !== REMOTE_PRESENCE) {
      // Ce qui vient de nous part sur le canal ; ce qui vient du réseau
      // est déjà connu de tout le monde.
      const touched = [...changes.added, ...changes.updated, ...changes.removed]
      transport.send('awareness', { update: toBase64(encodeAwarenessUpdate(awareness, touched)) })
    }
    notify()
  }

  return {
    isSynced: () => synced,
    start: () => {
      if (running) {
        return
      }
      running = true
      if (!readOnly) {
        stopUpdates = sync.onLocalUpdate((update) => {
          transport.send('yjs-update', { kind: 'update', update: toBase64(update) })
        })
      }
      awareness.on('update', onAwarenessChange)
      awareness.setLocalState(readOnly ? null : { user: me, cursor: null, selection: [], view: null, draft: null, ink: null, selectionBox: null })
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
      synced = false
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
          synced = true
          notify()
        }
        const vector = readText(payload, 'vector')
        if (vector === null) return
        if (readOnly) {
          // L’auteur peut arriver après l’observateur. Lui demander son état
          // ne publie ni présence ni modification du modèle.
          if (readText(payload, 'kind') === 'hello') transport.send('yjs-update', {
            kind: 'observe', vector: toBase64(sync.stateVector()),
          })
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

    publish: ({ cursor, selection, view = null, draft = null, ink = null, selectionBox = null }) => {
      if (running && !readOnly) {
        awareness.setLocalState({ user: me, cursor, selection, view, draft, ink, selectionBox })
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
            selectionBox: readSelectionBox(raw.selectionBox),
            view: readCollabView(raw.view),
            draft: readDraft(raw.draft),
            ink: readInk(raw.ink),
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
