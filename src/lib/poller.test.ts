import { describe, expect, it } from 'vitest'
import { createPoller } from './poller'

/** Horloge simulée : les minuteurs ne partent que quand on les avance. */
function fakeClock() {
  let nextId = 1
  const timers = new Map<number, { fn: () => void; due: number }>()
  let now = 0
  return {
    setTimer: (fn: () => void, ms: number) => {
      const id = nextId++
      timers.set(id, { fn, due: now + ms })
      return id
    },
    clearTimer: (id: number) => {
      timers.delete(id)
    },
    pending: () => timers.size,
    /** Avance le temps et déclenche ce qui est dû, dans l'ordre. */
    advance: async (ms: number) => {
      now += ms
      const due = [...timers.entries()]
        .filter(([, timer]) => timer.due <= now)
        .sort((a, b) => a[1].due - b[1].due)
      for (const [id, timer] of due) {
        timers.delete(id)
        timer.fn()
        // Les tours sont asynchrones : on laisse les promesses se dénouer.
        await Promise.resolve()
        await Promise.resolve()
      }
    },
  }
}

/** Promesse que l'on dénoue à la main, pour tenir un tour en vol. */
function deferred() {
  let release: () => void = () => {}
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release: () => release() }
}

/** Visibilité simulée, avec son interrupteur. */
function fakeVisibility() {
  let hidden = false
  const listeners = new Set<() => void>()
  return {
    isHidden: () => hidden,
    subscribeVisibility: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    listenerCount: () => listeners.size,
    set: (value: boolean) => {
      hidden = value
      for (const listener of [...listeners]) listener()
    },
  }
}

describe('rafraîchissement régulier', () => {
  it('lance un premier tour tout de suite, puis un par délai', async () => {
    const clock = fakeClock()
    const visibility = fakeVisibility()
    let tours = 0
    const poller = createPoller({
      run: async () => {
        tours += 1
      },
      delayMs: 3000,
      ...clock,
      ...visibility,
    })

    poller.start()
    await Promise.resolve()
    expect(tours).toBe(1)

    await clock.advance(3000)
    expect(tours).toBe(2)

    await clock.advance(3000)
    expect(tours).toBe(3)

    poller.stop()
  })

  it('n’empile pas les tours quand le serveur traîne', async () => {
    const clock = fakeClock()
    const visibility = fakeVisibility()
    let tours = 0
    const premier = deferred()
    const poller = createPoller({
      run: () => {
        tours += 1
        return premier.promise
      },
      delayMs: 3000,
      ...clock,
      ...visibility,
    })

    poller.start()
    await Promise.resolve()
    expect(tours).toBe(1)
    // Le premier tour n'a pas répondu : rien n'est programmé derrière.
    expect(clock.pending()).toBe(0)

    await clock.advance(9000)
    expect(tours).toBe(1)

    premier.release()
    await Promise.resolve()
    await Promise.resolve()
    expect(clock.pending()).toBe(1)

    await clock.advance(3000)
    expect(tours).toBe(2)

    poller.stop()
  })

  it('n’appelle pas dans le vide quand la page passe en arrière-plan', async () => {
    const clock = fakeClock()
    const visibility = fakeVisibility()
    let tours = 0
    const poller = createPoller({
      run: async () => {
        tours += 1
      },
      delayMs: 3000,
      ...clock,
      ...visibility,
    })

    poller.start()
    await Promise.resolve()
    expect(tours).toBe(1)

    visibility.set(true)
    expect(clock.pending()).toBe(0)
    await clock.advance(30_000)
    expect(tours).toBe(1)

    poller.stop()
  })

  it('reprend tout de suite au retour au premier plan', async () => {
    const clock = fakeClock()
    const visibility = fakeVisibility()
    let tours = 0
    const poller = createPoller({
      run: async () => {
        tours += 1
      },
      delayMs: 3000,
      ...clock,
      ...visibility,
    })

    poller.start()
    await Promise.resolve()
    visibility.set(true)
    await clock.advance(10_000)
    expect(tours).toBe(1)

    visibility.set(false)
    await Promise.resolve()
    await Promise.resolve()
    expect(tours).toBe(2)

    poller.stop()
  })

  it('ne part pas du tout si la page est déjà cachée', async () => {
    const clock = fakeClock()
    const visibility = fakeVisibility()
    visibility.set(true)
    let tours = 0
    const poller = createPoller({
      run: async () => {
        tours += 1
      },
      delayMs: 3000,
      ...clock,
      ...visibility,
    })

    poller.start()
    await Promise.resolve()
    expect(tours).toBe(0)
    expect(clock.pending()).toBe(0)

    poller.stop()
  })

  it('fait ignorer le tour en vol quand on arrête', async () => {
    const clock = fakeClock()
    const visibility = fakeVisibility()
    let attendu: boolean | null = null
    const tour = deferred()
    const poller = createPoller({
      run: async (stillWanted) => {
        await tour.promise
        attendu = stillWanted()
      },
      delayMs: 3000,
      ...clock,
      ...visibility,
    })

    poller.start()
    await Promise.resolve()
    poller.stop()
    tour.release()
    await Promise.resolve()
    await Promise.resolve()

    expect(attendu).toBe(false)
    expect(clock.pending()).toBe(0)
  })

  it('arrêter coupe le minuteur et se désabonne', async () => {
    const clock = fakeClock()
    const visibility = fakeVisibility()
    const poller = createPoller({ run: async () => {}, delayMs: 3000, ...clock, ...visibility })

    poller.start()
    await Promise.resolve()
    expect(clock.pending()).toBe(1)
    expect(visibility.listenerCount()).toBe(1)

    poller.stop()
    expect(clock.pending()).toBe(0)
    expect(visibility.listenerCount()).toBe(0)

    await clock.advance(30_000)
  })

  it('démarrer deux fois ne double pas les tours', async () => {
    const clock = fakeClock()
    const visibility = fakeVisibility()
    let tours = 0
    const poller = createPoller({
      run: async () => {
        tours += 1
      },
      delayMs: 3000,
      ...clock,
      ...visibility,
    })

    poller.start()
    poller.start()
    await Promise.resolve()
    expect(tours).toBe(1)
    expect(clock.pending()).toBe(1)

    poller.stop()
  })
})
