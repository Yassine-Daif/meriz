import { browserHidden, browserVisibility, createPoller } from './poller'
import type { Poller, PollerOptions } from './poller'
import { openEchoChannel } from './echoChannel'
import type { ChannelHandle, ChannelState, OpenChannel } from './echoChannel'

/**
 * Transport d'un travail observé. Le direct par websocket porte les
 * modifications dès qu'elles arrivent ; le rafraîchissement régulier
 * reste en filet, et reprend seul si le direct tombe ou n'a jamais pu
 * s'établir. Le prof ne doit jamais rester devant une image figée.
 *
 * Aucune dépendance à React : le canal, le rafraîchisseur et la source
 * de visibilité sont injectables, donc la bascule se vérifie.
 */

/** Repli : la cadence d'avant le direct. */
const REFRESH_MS = 3000
/**
 * Filet pendant le direct : une relecture complète de loin en loin. Elle
 * rattrape ce que le canal n'aurait pas porté, et date la consultation
 * pour l'élève, puisque le serveur l'estampille à chaque lecture.
 */
const SAFETY_NET_MS = 30_000

export interface LiveTransportOptions {
  assignmentId: string
  studentId: number
  /** Relit l'instantané et l'applique. Sert au repli comme au filet. */
  fetchSnapshot: (stillWanted: () => boolean) => Promise<void>
  /** Modèle reçu par le canal, tel quel. */
  onContent: (content: string) => void
  /* -------- Simulables, pour les essais -------- */
  openChannel?: OpenChannel
  makePoller?: (options: PollerOptions) => Poller
  isHidden?: () => boolean
  subscribeVisibility?: (listener: () => void) => () => void
  refreshMs?: number
  safetyNetMs?: number
}

export interface LiveTransport {
  start: () => void
  stop: () => void
}

export function createLiveTransport(options: LiveTransportOptions): LiveTransport {
  const openChannel = options.openChannel ?? openEchoChannel
  const makePoller = options.makePoller ?? createPoller
  const isHidden = options.isHidden ?? browserHidden
  const subscribeVisibility = options.subscribeVisibility ?? browserVisibility

  let running = false
  let channel: ChannelHandle | null = null
  let unsubscribe: (() => void) | null = null

  const poller = (delayMs: number) =>
    makePoller({
      run: options.fetchSnapshot,
      delayMs,
      isHidden,
      subscribeVisibility,
    })

  // Deux rafraîchisseurs, un seul en marche à la fois : le repli quand le
  // direct n'est pas établi, le filet quand il l'est.
  const fallback = poller(options.refreshMs ?? REFRESH_MS)
  const safetyNet = poller(options.safetyNetMs ?? SAFETY_NET_MS)

  /** Le direct porte les modifications : le repli laisse la place au filet. */
  const onState = (state: ChannelState) => {
    if (!running) {
      return
    }
    if (state === 'live') {
      fallback.stop()
      safetyNet.start()
      return
    }
    // En attente ou perdu, c'est le même besoin : que l'image continue.
    safetyNet.stop()
    fallback.start()
  }

  const openLink = () => {
    if (!running || channel !== null || isHidden()) {
      return
    }
    channel = openChannel({
      assignmentId: options.assignmentId,
      studentId: options.studentId,
      onContent: (content) => {
        if (running) {
          options.onContent(content)
        }
      },
      onState,
    })
  }

  const closeLink = () => {
    channel?.close()
    channel = null
  }

  /**
   * Page en arrière-plan : la connexion se ferme comme le
   * rafraîchissement s'arrête. Au retour, on rouvre, et le
   * rafraîchisseur en marche redemande aussitôt un instantané, ce qui
   * rattrape les modifications faites pendant l'absence.
   */
  const onVisibilityChange = () => {
    if (!running) {
      return
    }
    if (isHidden()) {
      closeLink()
      return
    }
    openLink()
  }

  return {
    start: () => {
      if (running) {
        return
      }
      running = true
      unsubscribe = subscribeVisibility(onVisibilityChange)
      // Le repli tourne d'emblée : tant que le canal n'a pas répondu,
      // l'image continue d'avancer.
      fallback.start()
      openLink()
    },
    stop: () => {
      running = false
      closeLink()
      fallback.stop()
      safetyNet.stop()
      unsubscribe?.()
      unsubscribe = null
    },
  }
}
