/**
 * Cadence d'envoi d'un geste continu. La première valeur part tout de
 * suite, pour que l'autre voie le geste démarrer sans délai ; ensuite,
 * au plus une valeur par intervalle, et c'est toujours la dernière
 * poussée qui part en fin de tour. Les valeurs sautées n'intéressent
 * personne : seule la position du moment compte.
 *
 * Aucune dépendance à React ni au navigateur : les sources sont
 * injectables, donc la mécanique se vérifie avec une horloge simulée.
 */

export interface ThrottleOptions {
  intervalMs: number
  now?: () => number
  setTimer?: (fn: () => void, ms: number) => number
  clearTimer?: (id: number) => void
}

export interface Throttled<T> {
  /** Valeur du moment : envoyée aussitôt, ou gardée pour la fin du tour. */
  push: (value: T) => void
  /** Envoie ce qui attend, maintenant, et referme le tour. */
  flush: () => void
  /**
   * Oublie ce qui attend. Indispensable à la fin d'un geste : une image
   * en retard qui partirait après la position finale remettrait le
   * nœud à côté.
   */
  cancel: () => void
}

export function createThrottle<T>(send: (value: T) => void, options: ThrottleOptions): Throttled<T> {
  const now = options.now ?? (() => Date.now())
  const setTimer = options.setTimer ?? ((fn, ms) => window.setTimeout(fn, ms))
  const clearTimer = options.clearTimer ?? ((id) => window.clearTimeout(id))

  let timer: number | null = null
  let waiting: { value: T } | null = null
  let lastSent: number | null = null

  const cancelTimer = () => {
    if (timer !== null) {
      clearTimer(timer)
      timer = null
    }
  }

  const sendNow = (value: T) => {
    lastSent = now()
    send(value)
  }

  /** Fin de tour : ce qui attendait part, et un tour s'ouvre si besoin. */
  const onTurnEnd = () => {
    timer = null
    if (waiting === null) {
      return
    }
    const next = waiting
    waiting = null
    sendNow(next.value)
    timer = setTimer(onTurnEnd, options.intervalMs)
  }

  return {
    push: (value) => {
      const elapsed = lastSent === null ? null : now() - lastSent
      if (timer === null && (elapsed === null || elapsed >= options.intervalMs)) {
        sendNow(value)
        timer = setTimer(onTurnEnd, options.intervalMs)
        return
      }
      waiting = { value }
    },

    flush: () => {
      cancelTimer()
      if (waiting === null) {
        return
      }
      const next = waiting
      waiting = null
      sendNow(next.value)
    },

    cancel: () => {
      cancelTimer()
      waiting = null
    },
  }
}
