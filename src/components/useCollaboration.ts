import { useCallback, useEffect, useRef, useState } from 'react'
import { createCollabProvider } from '../model/collabProvider'
import type {
  CollabCursor,
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
 * Entrer dans le canal, c'est y travailler : le prof qui se contente de
 * lire un travail n'ouvre rien du tout.
 *
 * Le cycle de vie tient en une phrase : la connexion s'ouvre en entrant
 * dans le contexte collaboratif, se ferme en le quittant, et se ferme
 * aussi quand l'onglet passe en arrière-plan. Elle ne reste jamais
 * ouverte pour rien.
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
export type CollabRole = 'owner' | 'guest' | 'member'

export interface CollaborationInfo {
  /** Document partagé : son identifiant côté serveur. */
  documentId: string
  me: CollabUser
  role: CollabRole
}

export interface CollaborationHandle {
  /** « off » : pas de contexte collaboratif, aucune connexion. */
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
  reportInk: (points: CollabCursor[] | null) => void
}

export interface UseCollaborationOptions {
  sync: ModelSync
  /** null : édition en solo, rien ne s'ouvre. */
  info: CollaborationInfo | null
  /** Ma sélection courante, publiée aux autres. */
  selection: string[]
  /* -------- Simulables, pour les essais -------- */
  openPresence?: OpenPresence
  isHidden?: () => boolean
  subscribeVisibility?: (listener: () => void) => () => void
}

export function useCollaboration({
  sync,
  info,
  selection,
  openPresence = openPresenceChannel,
  isHidden = browserHidden,
  subscribeVisibility = browserVisibility,
}: UseCollaborationOptions): CollaborationHandle {
  const [state, setState] = useState<ChannelState | 'off'>('off')
  const [participants, setParticipants] = useState<CollabUser[]>([])
  const [others, setOthers] = useState<RemotePresence[]>([])

  // La position du pointeur part au plus quinze fois par seconde : le
  // reste du temps elle attend son tour.
  const cursorRef = useRef<CollabCursor | null>(null)
  const selectionRef = useRef<string[]>(selection)
  // Le tracé en cours part avec le curseur, dans le même message.
  const draftRef = useRef<CollabDraftLink | null>(null)
  const inkRef = useRef<CollabInk | null>(null)
  const publishRef = useRef<CollabProvider['publish'] | null>(null)

  const documentId = info?.documentId ?? null
  const meId = info?.me.id ?? null
  const meKey = info === null ? '' : JSON.stringify(info.me)

  useEffect(() => {
    if (documentId === null || meKey === '') {
      return
    }
    const me = JSON.parse(meKey) as CollabUser
    let channel: PresenceHandle | null = null
    let stopped = false

    const provider = createCollabProvider({
      sync,
      transport: { send: (event, payload) => channel?.send(event, payload) },
      me,
    })
    publishRef.current = provider.publish

    const refreshOthers = () => setOthers(provider.others())
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
        onMessage: (event, payload) => provider.receive(event, payload),
        onState: (next) => {
          setState(next)
          if (stopped) {
            return
          }
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
              draft: draftRef.current,
              ink: inkRef.current,
            })
          } else {
            // Le lien reviendra avec une nouvelle poignée de main, donc
            // une nouvelle synchronisation : on repart propre.
            provider.stop()
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
      // Un tracé ne survit jamais à une fermeture : onglet caché, lien
      // perdu ou démontage, il repart de rien. Le trait de crayon non plus.
      draftRef.current = null
      inkRef.current = null
    }

    /**
     * Onglet en arrière-plan : on ferme, comme le fait l'observation.
     * Au retour, on rouvre, et la poignée de main resynchronise.
     */
    const onVisibilityChange = () => {
      if (stopped) {
        return
      }
      if (isHidden()) {
        setState('connecting')
        close()
        return
      }
      open()
    }
    const unsubscribe = subscribeVisibility(onVisibilityChange)

    open()

    // La position du pointeur et la sélection partent à cadence tenue.
    const ticker = window.setInterval(() => {
      provider.publish({
        cursor: cursorRef.current,
        selection: selectionRef.current,
        draft: draftRef.current,
        ink: inkRef.current,
      })
    }, CURSOR_INTERVAL_MS)

    return () => {
      stopped = true
      window.clearInterval(ticker)
      unsubscribe()
      stopPresence()
      close()
      publishRef.current = null
      setState('off')
    }
  }, [sync, documentId, meKey, openPresence, isHidden, subscribeVisibility])

  // La sélection suit le rendu, sans redémarrer la connexion.
  useEffect(() => {
    selectionRef.current = selection
  }, [selection])

  const reportCursor = useCallback((cursor: CollabCursor | null) => {
    cursorRef.current = cursor
  }, [])

  const reportDraftLink = useCallback((from: CollabCursor | null) => {
    draftRef.current = from === null ? null : { from }
  }, [])

  const reportInk = useCallback((points: CollabCursor[] | null) => {
    // Un point seul ne dessine rien : autant ne rien publier.
    inkRef.current = points === null || points.length < 2 ? null : { points }
  }, [])

  return {
    state: documentId === null ? 'off' : state,
    participants: meId === null ? [] : participants,
    others,
    reportCursor,
    reportDraftLink,
    reportInk,
  }
}
