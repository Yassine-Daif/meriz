import { useCallback, useEffect, useRef, useState } from 'react'
import { createCollabProvider, visibleCollaborators } from '../model/collabProvider'
import type {
  CollabCursor,
  CollabSelectionBox,
  CollabView,
  CollabDraftLink,
  CollabInk,
  CollabProvider,
  CollabUser,
  RemotePresence,
} from '../model/collabProvider'
import type { ModelSync } from '../model/modelDoc'
import type { ChannelState } from '../lib/echoClient'
import { openPresenceChannel } from '../lib/presenceChannel'
import type { OpenPresence, PresenceHandle } from '../lib/presenceChannel'
import { browserHidden, browserVisibility } from '../lib/poller'

/**
 * Co-édition d'un document : la connexion, la présence et les curseurs.
 * Entrer dans le canal permet aussi l'observation silencieuse : ce mode reçoit
 * les mises à jour, sans publier de présence ni d'écriture.
 *
 * Le cycle de vie tient en une phrase : la connexion s'ouvre en entrant
 * dans le contexte collaboratif, se ferme en le quittant, et se ferme
 * en arrière-plan en observation seule. Les éditeurs gardent leur présence,
 * sans diffuser leurs mouvements tant que l’onglet est masqué.
 *
 * Sans contexte collaboratif, le crochet ne fait rien du tout : l'édition
 * en solo ne se connecte à aucun canal.
 */

/** Cadence d'envoi du curseur : assez fluide, sans inonder le canal. */
const CURSOR_INTERVAL_MS = 66

/**
 * Ma place sur ce document partagé.
 *
 * `owner` : il est à moi, je l'ensemence et je l'enregistre.
 * `guest` : j'entre chez quelqu'un, je pars vide et je n'enregistre pas.
 * `member` : pair parmi des pairs, dans un groupe. Je pars vide, j'adopte
 * le contenu du serveur si personne ne l'a fait, et j'enregistre.
 */
export type CollabRole = 'owner' | 'guest' | 'member' | 'observer'

export interface CollaborationInfo {
  /** Document partagé : son identifiant côté serveur. */
  documentId: string
  me: CollabUser
  role: CollabRole
  ownerId?: number
}

export interface CollaborationHandle {
  /** « off » : pas de contexte collaboratif, aucune connexion. */
  synced: boolean
  state: ChannelState | 'off'
  /** Les autres présents dans le canal. */
  participants: CollabUser[]
  /** Leurs curseurs et sélections, à dessiner. */
  others: RemotePresence[]
  /** Ma position de pointeur, en coordonnées du modèle. */
  reportCursor: (cursor: CollabCursor | null) => void
  /**
   * La liaison que je suis en train de tirer, pour que les autres la
   * voient se dessiner. Null : j'ai lâché, ou je n'ai rien commencé.
   */
  reportDraftLink: (from: CollabCursor | null) => void
  /**
   * Le trait de crayon que je suis en train de tracer. Null : plus rien.
   * Éphémère de bout en bout, il ne touche jamais le modèle.
   */
  reportInk: (ink: CollabInk | null) => void
  commentsVersion: number
  notifyCommentsChanged: () => void
  reportSelectionBox: (box: CollabSelectionBox | null) => void
}

export interface UseCollaborationOptions {
  onSourceChanged?: () => void
  sync: ModelSync
  /** null : édition en solo, rien ne s'ouvre. */
  info: CollaborationInfo | null
  /** Ma sélection courante, publiée aux autres. */
  selection: string[]
  view?: CollabView | null
  /* -------- Simulables, pour les essais -------- */
  openPresence?: OpenPresence
  isHidden?: () => boolean
  subscribeVisibility?: (listener: () => void) => () => void
}

export function useCollaboration({
  sync,
  onSourceChanged,
  info,
  selection,
  view = null,
  openPresence = openPresenceChannel,
  isHidden = browserHidden,
  subscribeVisibility = browserVisibility,
}: UseCollaborationOptions): CollaborationHandle {
  const [commentsVersion, setCommentsVersion] = useState(0)
  const notifyRef = useRef<(() => void) | null>(null)
  const lastNotice = useRef(0)
  const notifyCommentsChanged = useCallback(() => notifyRef.current?.(), [])
  const [synced, setSynced] = useState(false)
  const [state, setState] = useState<ChannelState | 'off'>('off')
  const [participants, setParticipants] = useState<CollabUser[]>([])
  const [others, setOthers] = useState<RemotePresence[]>([])

  // La position du pointeur part au plus quinze fois par seconde : le
  // reste du temps elle attend son tour.
  const cursorRef = useRef<CollabCursor | null>(null)
  const selectionRef = useRef<string[]>(selection)
  const viewRef = useRef(view)
  // Le tracé en cours part avec le curseur, dans le même message.
  const draftRef = useRef<CollabDraftLink | null>(null)
  const inkRef = useRef<CollabInk | null>(null)
  const selectionBoxRef = useRef<CollabSelectionBox | null>(null)
  const publishRef = useRef<CollabProvider['publish'] | null>(null)

  const sourceOwnerId = info?.ownerId ?? null
  const sourceIdentity = useRef<{ documentId: string | null; clientId: number | null; known: Set<number> }>({ documentId: null, clientId: null, known: new Set() })
  const observer = info?.role === 'observer'
  const member = info?.role === 'member'
  const documentId = info?.documentId ?? null
  const meId = info?.me.id ?? null
  const meKey = info === null ? '' : JSON.stringify(info.me)

  useEffect(() => {
    if (documentId === null || meKey === '') {
      return
    }
    if (sourceIdentity.current.documentId !== documentId) sourceIdentity.current = { documentId, clientId: null, known: new Set() }
    const me = JSON.parse(meKey) as CollabUser
    let channel: PresenceHandle | null = null
    let stopped = false

    const provider = createCollabProvider({
      sync,
      transport: { send: (event, payload) => channel?.send(event, payload) },
      me,
      readOnly: observer,
    })
    publishRef.current = provider.publish
    notifyRef.current = () => channel?.send('comments-changed', {})

    const refreshOthers = () => {
      const next = provider.others()
      const candidates = next.filter((other) => other.user.id === sourceOwnerId)
      const owner = candidates.find((other) => !sourceIdentity.current.known.has(other.clientId))
        ?? candidates.find((other) => other.clientId === sourceIdentity.current.clientId) ?? candidates[0]
      if (owner) {
        sourceIdentity.current.known.add(owner.clientId)
        if (sourceIdentity.current.known.size > 128) {
          const oldest = sourceIdentity.current.known.values().next().value
          if (oldest !== undefined) sourceIdentity.current.known.delete(oldest)
        }
      }
      if (owner && sourceIdentity.current.clientId !== null && sourceIdentity.current.clientId !== owner.clientId && onSourceChanged) {
        sourceIdentity.current.clientId = owner.clientId
        // Un rechargement de l’élève crée un nouveau document Yjs : l’ancien
        // ne doit jamais être renvoyé par le prof comme s’il était encore la source.
        provider.stop()
        setSynced(false)
        onSourceChanged()
        return
      }
      if (owner) sourceIdentity.current.clientId = owner.clientId
      setOthers(next)
      setSynced(provider.isSynced())
    }
    const stopPresence = provider.onPresence(refreshOthers)

    const open = () => {
      if (stopped || channel !== null || isHidden()) {
        return
      }
      channel = openPresence({
        documentId,
        onHere: (members) => setParticipants(members.filter((member) => member.id !== me.id)),
        onJoin: (member) =>
          setParticipants((previous) =>
            member.id === me.id || previous.some((other) => other.id === member.id)
              ? previous
              : [...previous, member],
          ),
        onLeave: (member) => {
          setParticipants((previous) => previous.filter((other) => other.id !== member.id))
          // Son curseur s'en va avec lui, sans attendre d'expiration.
          provider.forget(member.id)
          refreshOthers()
        },
        onMessage: (event, payload) => {
          if (stopped) return
          if (event === 'comments-changed') {
            if (Date.now() - lastNotice.current > 500) {
              lastNotice.current = Date.now()
              setCommentsVersion((version) => version + 1)
            }
          } else provider.receive(event, payload)
        },
        onState: (next) => {
          if (stopped) return
          setState(next)
          /*
           * La poignée de main attend que le canal soit vivant : un
           * message envoyé avant l'abonnement serait perdu, et personne
           * ne nous enverrait jamais ce qui nous manque.
           */
          if (next === 'live') {
            provider.start()
            provider.publish({
              cursor: cursorRef.current,
              selection: selectionRef.current,
              view: viewRef.current,
              draft: draftRef.current,
              ink: inkRef.current,
        selectionBox: selectionBoxRef.current,
            })
          } else {
            // Le lien reviendra avec une nouvelle poignée de main, donc
            // une nouvelle synchronisation : on repart propre.
            provider.stop()
            setSynced(false)
          }
        },
      })
    }

    const close = () => {
      provider.stop()
      channel?.close()
      channel = null
      setParticipants([])
      setOthers([])
      setSynced(false)
      // Un tracé ne survit jamais à une fermeture : onglet caché, lien
      // perdu ou démontage, il repart de rien. Le trait de crayon non plus.
      draftRef.current = null
      inkRef.current = null
      selectionBoxRef.current = null
    }

    /**
     * En arrière-plan, seul l’observateur ferme son abonnement.
     * Un éditeur conserve sa présence et suspend les gestes éphémères.
     */
    const onVisibilityChange = () => {
      if (stopped) {
        return
      }
      if (isHidden()) {
        if (observer) { setState('connecting'); close() }
        else {
          cursorRef.current = null
          draftRef.current = null
          inkRef.current = null
          selectionBoxRef.current = null
          provider.publish({ cursor: null, selection: [], view: viewRef.current })
        }
        return
      }
      open()
    }
    const unsubscribe = subscribeVisibility(onVisibilityChange)

    open()

    // La position du pointeur et la sélection partent à cadence tenue.
    const ticker = window.setInterval(() => {
      if (isHidden()) return
      provider.publish({
        cursor: cursorRef.current,
        selection: selectionRef.current,
        view: viewRef.current,
        draft: draftRef.current,
        ink: inkRef.current,
              selectionBox: selectionBoxRef.current,
      })
    }, CURSOR_INTERVAL_MS)

    return () => {
      stopped = true
      window.clearInterval(ticker)
      unsubscribe()
      stopPresence()
      close()
      publishRef.current = null
      notifyRef.current = null
      setState('off')
    }
  }, [sync, documentId, meKey, observer, sourceOwnerId, onSourceChanged, openPresence, isHidden, subscribeVisibility])

  // La sélection suit le rendu, sans redémarrer la connexion.
  useEffect(() => {
    selectionRef.current = selection
  }, [selection])

  useEffect(() => {
    viewRef.current = view
    selectionBoxRef.current = null
  }, [view])

  const reportCursor = useCallback((cursor: CollabCursor | null) => {
    cursorRef.current = cursor
  }, [])

  const reportDraftLink = useCallback((from: CollabCursor | null) => {
    draftRef.current = from === null ? null : { from }
  }, [])

  const reportInk = useCallback((ink: CollabInk | null) => {
    inkRef.current = ink
  }, [])

  const reportSelectionBox = useCallback((box: CollabSelectionBox | null) => {
    selectionBoxRef.current = box
  }, [])

  return {
    synced,
    commentsVersion,
    notifyCommentsChanged,
    state: documentId === null ? 'off' : state,
    participants: meId === null ? [] : visibleCollaborators(participants, others, member),
    others,
    reportCursor,
    reportDraftLink,
    reportInk,
    reportSelectionBox,
  }
}
