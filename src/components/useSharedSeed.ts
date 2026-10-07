import { useEffect, useRef, useState } from 'react'
import type { McdEditorState } from '../model/mcdReducer'
import { electsSeeder } from '../model/seedElection'
import type { ChannelState } from '../lib/echoClient'

/**
 * L'ensemencement d'un document partagé, après la poignée de main.
 *
 * Un document de groupe naît vide côté Yjs : si deux membres y
 * inscrivaient le contenu du serveur avant de s'être parlé, le modèle
 * apparaîtrait en double. On attend donc que la synchronisation ait eu
 * le temps d'arriver, puis, si le document est toujours vide, le pair
 * élu adopte le contenu venu du serveur.
 *
 * Le canal peut ne jamais s'établir : sans filet, le membre regarderait
 * une page blanche alors que le serveur a le contenu. Passé un délai
 * plus long, on adopte donc sans élection.
 */

/** Canal vivant : le temps d'un aller-retour de poignée de main. */
const ADOPT_AFTER_LIVE_MS = 1200
/** Canal absent : on n'attend pas indéfiniment un pair qui ne viendra pas. */
const ADOPT_WITHOUT_LINK_MS = 4000

export interface SharedSeedOptions {
  /** Vrai pour un membre de groupe seulement. */
  active: boolean
  /** Contenu venu du serveur, à adopter si personne ne l'a fait. */
  initial: McdEditorState
  /** Le document Yjs est encore vide. */
  empty: boolean
  state: ChannelState | 'off'
  /** Mon identifiant de client Yjs. */
  clientId: number
  /** Ceux des pairs vus dans la présence. */
  peerIds: readonly number[]
  adopt: (state: McdEditorState) => void
}

export interface SharedSeedHandle {
  /** Vrai quand plus rien n'attend : l'enregistrement peut reprendre. */
  ready: boolean
}

export function useSharedSeed({
  active,
  initial,
  empty,
  state,
  clientId,
  peerIds,
  adopt,
}: SharedSeedOptions): SharedSeedHandle {
  const [ready, setReady] = useState(!active)

  // Valeurs qui changent à chaque image de curseur : lues au moment de
  // décider, jamais en dépendance, sinon le minuteur repartirait sans fin.
  const emptyRef = useRef(empty)
  const peersRef = useRef(peerIds)
  const initialRef = useRef(initial)
  const adoptRef = useRef(adopt)
  emptyRef.current = empty
  peersRef.current = peerIds
  initialRef.current = initial
  adoptRef.current = adopt

  // Verrou à un coup : on n'ensemence jamais deux fois, et on ne touche
  // plus à rien dès que le contenu est arrivé d'un pair.
  const settled = useRef(!active)
  useEffect(() => {
    if (!active || settled.current || empty) {
      return
    }
    settled.current = true
    setReady(true)
  }, [active, empty])

  useEffect(() => {
    if (!active || settled.current) {
      return
    }
    const live = state === 'live'
    const timer = window.setTimeout(() => {
      if (settled.current) {
        return
      }
      settled.current = true
      /*
       * La condition de vide se vérifie ici, au moment d'adopter :
       * `adopt` réécrit tout le document, donc adopter sur un modèle
       * déjà rempli par un pair effacerait son travail.
       */
      if (emptyRef.current && (!live || electsSeeder(clientId, peersRef.current))) {
        adoptRef.current(initialRef.current)
      }
      setReady(true)
    }, live ? ADOPT_AFTER_LIVE_MS : ADOPT_WITHOUT_LINK_MS)
    return () => window.clearTimeout(timer)
  }, [active, state, clientId])

  return { ready }
}
