/** Préférence locale des effets. La réduction des mouvements du système reste prioritaire. */
export const MOTION_STORAGE_KEY = 'meriz-motion'
export interface MotionState {
  preference: boolean
  reduced: boolean
  enabled: boolean
}

function readPreference(): boolean {
  try { return localStorage.getItem(MOTION_STORAGE_KEY) !== 'off' } catch { return true }
}

function createMotionStore() {
  const media = typeof window !== 'undefined' ? window.matchMedia?.('(prefers-reduced-motion: reduce)') : undefined
  const listeners = new Set<() => void>()
  const resolve = (preference: boolean): MotionState => ({
    preference, reduced: media?.matches === true, enabled: preference && media?.matches !== true,
  })
  let state = resolve(readPreference())
  const apply = () => {
    if (typeof document !== 'undefined') document.documentElement.dataset.motion = state.enabled ? 'on' : 'off'
  }
  const update = (preference: boolean) => {
    const next = resolve(preference)
    if (next.preference === state.preference && next.reduced === state.reduced) return
    state = next
    apply()
    for (const listener of listeners) listener()
  }
  // Avant le premier rendu : une préférence désactivée ne produit aucun flash animé.
  apply()
  media?.addEventListener('change', () => update(state.preference))
  if (typeof window !== 'undefined') window.addEventListener('storage', (event) => {
    if (event.key === MOTION_STORAGE_KEY) update(event.newValue !== 'off')
    else if (event.key === null) update(readPreference())
  })
  return {
    getState: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    setPreference: (enabled: boolean) => {
      try { localStorage.setItem(MOTION_STORAGE_KEY, enabled ? 'on' : 'off') } catch {
        // Le choix reste utilisable pendant la session si le stockage est bloqué.
      }
      update(enabled)
    },
  }
}
export const motionStore = createMotionStore()
