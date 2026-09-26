/**
 * Rafraîchissement régulier d'une vue ouverte. Trois règles tiennent
 * tout : un tour à la fois, le suivant programmé quand le précédent a
 * répondu ; rien ne part tant que la page est en arrière-plan ; arrêter
 * coupe le minuteur et fait ignorer le tour en vol.
 *
 * Aucune dépendance à React ni au navigateur : les sources sont
 * injectables, donc la mécanique se vérifie avec une horloge simulée.
 */

export interface PollerOptions {
  /**
   * Le tour de rafraîchissement. Ses erreurs sont à lui, jamais lancées
   * ici. Il reçoit de quoi savoir si son résultat est encore attendu :
   * une réponse qui arrive après l'arrêt ne doit rien afficher.
   */
  run: (stillWanted: () => boolean) => Promise<void>
  delayMs: number
  /** Page en arrière-plan : on n'appelle pas dans le vide. */
  isHidden?: () => boolean
  /** Abonnement aux changements de visibilité, qui rend son désabonnement. */
  subscribeVisibility?: (listener: () => void) => () => void
  setTimer?: (fn: () => void, ms: number) => number
  clearTimer?: (id: number) => void
}

export interface Poller {
  start: () => void
  stop: () => void
}

/** Sources du navigateur, quand on ne les simule pas. */
export function browserHidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden'
}

export function browserVisibility(listener: () => void): () => void {
  if (typeof document === 'undefined') {
    return () => {}
  }
  document.addEventListener('visibilitychange', listener)
  return () => document.removeEventListener('visibilitychange', listener)
}

export function createPoller(options: PollerOptions): Poller {
  const isHidden = options.isHidden ?? browserHidden
  const subscribeVisibility = options.subscribeVisibility ?? browserVisibility
  const setTimer = options.setTimer ?? ((fn, ms) => window.setTimeout(fn, ms))
  const clearTimer = options.clearTimer ?? ((id) => window.clearTimeout(id))

  let running = false
  let inFlight = false
  let timer: number | null = null
  let unsubscribe: (() => void) | null = null

  const cancelTimer = () => {
    if (timer !== null) {
      clearTimer(timer)
      timer = null
    }
  }

  const schedule = () => {
    cancelTimer()
    if (!running) {
      return
    }
    timer = setTimer(() => {
      timer = null
      void tick()
    }, options.delayMs)
  }

  const tick = async () => {
    // Un tour à la fois : un serveur lent ne fait pas s'empiler les appels.
    if (!running || inFlight) {
      return
    }
    if (isHidden()) {
      // Caché : on ne programme rien, le retour au premier plan relancera.
      return
    }
    inFlight = true
    try {
      await options.run(() => running)
    } finally {
      inFlight = false
    }
    schedule()
  }

  const onVisibilityChange = () => {
    if (!running || isHidden()) {
      // Passage en arrière-plan : plus rien ne se programme.
      cancelTimer()
      return
    }
    // Retour au premier plan : tout de suite, pas dans trois secondes.
    cancelTimer()
    void tick()
  }

  return {
    start: () => {
      if (running) {
        return
      }
      running = true
      unsubscribe = subscribeVisibility(onVisibilityChange)
      void tick()
    },
    stop: () => {
      running = false
      cancelTimer()
      unsubscribe?.()
      unsubscribe = null
    },
  }
}
