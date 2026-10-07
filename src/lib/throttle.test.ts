import { describe, expect, it } from 'vitest'
import { createThrottle } from './throttle'

/** Horloge simulée : rien ne part tant qu'on n'avance pas le temps. */
function fakeClock() {
  let nextId = 1
  const timers = new Map<number, { fn: () => void; due: number }>()
  let now = 0
  return {
    now: () => now,
    setTimer: (fn: () => void, ms: number) => {
      const id = nextId++
      timers.set(id, { fn, due: now + ms })
      return id
    },
    clearTimer: (id: number) => {
      timers.delete(id)
    },
    pending: () => timers.size,
    advance: (ms: number) => {
      now += ms
      const due = [...timers.entries()]
        .filter(([, timer]) => timer.due <= now)
        .sort((a, b) => a[1].due - b[1].due)
      for (const [id, timer] of due) {
        timers.delete(id)
        timer.fn()
      }
    },
  }
}

function monte(intervalMs = 66) {
  const clock = fakeClock()
  const envois: number[] = []
  const throttled = createThrottle<number>((valeur) => envois.push(valeur), {
    intervalMs,
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  })
  return { clock, envois, throttled }
}

describe('cadence d un geste', () => {
  it('envoie la première valeur sans attendre', () => {
    const { envois, throttled } = monte()
    throttled.push(1)
    expect(envois).toEqual([1])
  })

  it('fond les valeurs d un même tour et n en garde que la dernière', () => {
    const { clock, envois, throttled } = monte()
    throttled.push(1)
    throttled.push(2)
    throttled.push(3)
    throttled.push(4)
    throttled.push(5)
    expect(envois).toEqual([1])
    clock.advance(66)
    expect(envois).toEqual([1, 5])
  })

  it('tient la cadence sur un geste long', () => {
    const { clock, envois, throttled } = monte()
    for (let image = 1; image <= 12; image += 1) {
      throttled.push(image)
      clock.advance(22)
    }
    // Douze images en 264 ms : une au départ, puis une par tour de 66 ms.
    expect(envois.length).toBeLessThanOrEqual(5)
    expect(envois[0]).toBe(1)
    expect(envois[envois.length - 1]).toBeGreaterThan(1)
  })

  it('vide ce qui attend, tout de suite', () => {
    const { clock, envois, throttled } = monte()
    throttled.push(1)
    throttled.push(2)
    throttled.flush()
    expect(envois).toEqual([1, 2])
    // Le tour est refermé : plus rien ne part de lui-même.
    clock.advance(200)
    expect(envois).toEqual([1, 2])
    expect(clock.pending()).toBe(0)
  })

  it('ne vide rien quand rien n attend', () => {
    const { envois, throttled } = monte()
    throttled.push(1)
    throttled.flush()
    throttled.flush()
    expect(envois).toEqual([1])
  })

  it('oublie ce qui attend, pour qu aucune image en retard ne passe', () => {
    const { clock, envois, throttled } = monte()
    throttled.push(1)
    throttled.push(2)
    throttled.cancel()
    clock.advance(200)
    expect(envois).toEqual([1])
    expect(clock.pending()).toBe(0)
  })

  it('repart à neuf après une annulation', () => {
    const { clock, envois, throttled } = monte()
    throttled.push(1)
    throttled.cancel()
    clock.advance(66)
    throttled.push(2)
    expect(envois).toEqual([1, 2])
  })
})
