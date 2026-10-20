import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('préférence des animations', () => {
  const values = new Map<string, string>()
  let reduced = false
  let systemChanged: () => void
  let storageChanged: (event: { key: string | null; newValue: string | null }) => void
  const dataset: Record<string, string> = {}

  beforeEach(() => {
    vi.resetModules()
    values.clear()
    reduced = false
    delete dataset.motion
    vi.stubGlobal('document', { documentElement: { dataset } })
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    })
    vi.stubGlobal('window', {
      matchMedia: () => ({
        get matches() { return reduced },
        addEventListener: (_: string, callback: () => void) => { systemChanged = callback },
      }),
      addEventListener: (_: string, callback: typeof storageChanged) => { storageChanged = callback },
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('applique un choix désactivé avant le rendu et le conserve au rechargement', async () => {
    values.set('meriz-motion', 'off')
    const { motionStore } = await import('./motion')
    expect(dataset.motion).toBe('off')
    expect(motionStore.getState().enabled).toBe(false)
    motionStore.setPreference(true)
    expect(dataset.motion).toBe('on')
    expect(values.get('meriz-motion')).toBe('on')
    vi.resetModules()
    expect((await import('./motion')).motionStore.getState().enabled).toBe(true)
  })

  it('suit immédiatement le mouvement réduit sans perdre le choix personnel', async () => {
    const { motionStore } = await import('./motion')
    const changed = vi.fn()
    motionStore.subscribe(changed)
    reduced = true
    systemChanged()
    expect(motionStore.getState()).toEqual({ preference: true, reduced: true, enabled: false })
    expect(dataset.motion).toBe('off')
    motionStore.setPreference(false)
    reduced = false
    systemChanged()
    expect(motionStore.getState().enabled).toBe(false)
    expect(changed).toHaveBeenCalledTimes(3)
  })

  it('la réduction système prime aussi sur une activation explicite', async () => {
    reduced = true
    const { motionStore } = await import('./motion')
    motionStore.setPreference(true)
    expect(dataset.motion).toBe('off')
    reduced = false
    systemChanged()
    expect(dataset.motion).toBe('on')
  })

  it('synchronise les fenêtres et prend en compte un effacement du stockage', async () => {
    const { motionStore } = await import('./motion')
    storageChanged({ key: 'meriz-motion', newValue: 'off' })
    expect(motionStore.getState().enabled).toBe(false)
    storageChanged({ key: 'autre-reglage', newValue: 'off' })
    expect(motionStore.getState().enabled).toBe(false)
    storageChanged({ key: null, newValue: null })
    expect(motionStore.getState().enabled).toBe(true)
  })

  it('reste réglable si le stockage est refusé, sans notifier après désabonnement', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('bloqué') },
      setItem: () => { throw new Error('bloqué') },
    })
    const { motionStore } = await import('./motion')
    const changed = vi.fn()
    const unsubscribe = motionStore.subscribe(changed)
    motionStore.setPreference(false)
    expect(dataset.motion).toBe('off')
    unsubscribe()
    motionStore.setPreference(true)
    expect(changed).toHaveBeenCalledTimes(1)
  })
})
