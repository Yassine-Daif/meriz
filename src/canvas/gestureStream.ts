import { useCallback, useEffect, useRef } from 'react'
import type { Dispatch } from 'react'
import { createThrottle } from '../lib/throttle'
import type { Throttled } from '../lib/throttle'
import type { McdAction } from '../model/mcdReducer'

/**
 * Un geste du canevas, diffusé pendant qu'il se fait. Glisser un nœud
 * ou l'étiquette d'une patte écrit dans le modèle au fil du mouvement,
 * donc l'autre participant voit le déplacement bouger au lieu de le
 * voir se téléporter au lâcher.
 *
 * Deux choses sont séparées, et c'est tout l'objet de ce module. Les
 * images intermédiaires partent à cadence tenue, pour la fluidité. Et
 * elles portent toutes le même jeton, donc l'historique n'en fait
 * qu'une seule étape : annuler recule du geste entier, jamais d'un
 * pixel.
 */

/** Même cadence que les curseurs : le pair reçoit un tout cohérent. */
export const GESTURE_INTERVAL_MS = 66

/**
 * Un geste sans image depuis une seconde est tenu pour fini. React Flow
 * n'appelle pas la fin du glisser quand on l'abandonne par Échap : sans
 * cette péremption, le jeton resterait posé et le geste suivant s'y
 * fondrait.
 */
const STALE_MS = 1000

/** Les jetons sont uniques dans la page, pas seulement dans un composant. */
let nextToken = 0

export interface GestureStream {
  /** Ouvre un geste et rend son jeton. */
  begin: () => string
  /** Image intermédiaire : envoyée à cadence tenue. */
  push: (action: McdAction) => void
  /** Fin du geste : l'attente est jetée, l'état exact est écrit. */
  commit: (action: McdAction) => void
  /** Le jeton du geste en cours, ou null s'il n'y en a pas. */
  token: () => string | null
}

export function useGestureStream(dispatch: Dispatch<McdAction>): GestureStream {
  /*
   * L'identité de `dispatch` change quand l'éditeur se verrouille, par
   * exemple quand le lien de co-édition tombe en pleine traînée. On la
   * lit donc au moment d'envoyer : une fermeture périmée continuerait
   * d'écrire dans un éditeur devenu inerte.
   */
  const dispatchRef = useRef(dispatch)
  useEffect(() => {
    dispatchRef.current = dispatch
  }, [dispatch])

  const throttleRef = useRef<Throttled<McdAction> | null>(null)
  if (throttleRef.current === null) {
    throttleRef.current = createThrottle<McdAction>((action) => dispatchRef.current(action), {
      intervalMs: GESTURE_INTERVAL_MS,
    })
  }
  const throttled = throttleRef.current

  const tokenRef = useRef<string | null>(null)
  const touchedRef = useRef(0)

  // Démontage en pleine traînée : ce qui attendait ne part jamais.
  useEffect(() => () => throttleRef.current?.cancel(), [])

  const token = useCallback(() => {
    if (tokenRef.current === null) {
      return null
    }
    if (Date.now() - touchedRef.current > STALE_MS) {
      tokenRef.current = null
      throttled.cancel()
      return null
    }
    return tokenRef.current
  }, [throttled])

  const begin = useCallback(() => {
    nextToken += 1
    const fresh = `geste-${nextToken}`
    tokenRef.current = fresh
    touchedRef.current = Date.now()
    return fresh
  }, [])

  const push = useCallback(
    (action: McdAction) => {
      touchedRef.current = Date.now()
      throttled.push(action)
    },
    [throttled],
  )

  const commit = useCallback(
    (action: McdAction) => {
      throttled.cancel()
      tokenRef.current = null
      dispatchRef.current(action)
    },
    [throttled],
  )

  return { begin, push, commit, token }
}
