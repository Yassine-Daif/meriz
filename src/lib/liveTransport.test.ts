import { describe, expect, it } from 'vitest'
import type { ChannelState, OpenChannelOptions } from './echoChannel'
import { createLiveTransport } from './liveTransport'
import type { Poller, PollerOptions } from './poller'

/** Rafraîchisseur simulé : on veut juste savoir lequel tourne. */
function fakePollers() {
  const made: { delayMs: number; running: boolean; run: PollerOptions['run'] }[] = []
  const makePoller = (options: PollerOptions): Poller => {
    const entry = { delayMs: options.delayMs, running: false, run: options.run }
    made.push(entry)
    return {
      start: () => {
        entry.running = true
      },
      stop: () => {
        entry.running = false
      },
    }
  }
  const byDelay = (delayMs: number) => made.find((entry) => entry.delayMs === delayMs)
  return {
    makePoller,
    /** Le repli, à 3 secondes. */
    fallback: () => byDelay(3000),
    /** Le filet du direct, à 30 secondes. */
    safetyNet: () => byDelay(30_000),
    count: () => made.length,
  }
}

/** Canal simulé : on décide de son état, et de ce qu'il porte. */
function fakeChannel() {
  const opened: OpenChannelOptions[] = []
  let closes = 0
  const openChannel = (options: OpenChannelOptions) => {
    opened.push(options)
    return {
      close: () => {
        closes += 1
      },
    }
  }
  const last = () => opened[opened.length - 1]
  return {
    openChannel,
    openings: () => opened.length,
    closes: () => closes,
    target: () => (last() ? { assignmentId: last()!.assignmentId, studentId: last()!.studentId } : null),
    /** Fait passer le canal dans un état, comme le ferait le serveur. */
    say: (state: ChannelState) => last()?.onState(state),
    /** Fait arriver un modèle par le canal. */
    send: (content: string) => last()?.onContent(content),
  }
}

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

interface EssaiOptions {
  /** Page déjà en arrière-plan au démarrage. */
  hidden?: boolean
}

function essai(options: EssaiOptions = {}) {
  const pollers = fakePollers()
  const channel = fakeChannel()
  const visibility = fakeVisibility()
  if (options.hidden) {
    visibility.set(true)
  }
  const recus: string[] = []
  const transport = createLiveTransport({
    assignmentId: '01JB',
    studentId: 12,
    fetchSnapshot: async () => {},
    onContent: (content) => recus.push(content),
    openChannel: channel.openChannel,
    makePoller: pollers.makePoller,
    isHidden: visibility.isHidden,
    subscribeVisibility: visibility.subscribeVisibility,
  })
  return { transport, pollers, channel, visibility, recus }
}

describe('transport d’un travail observé', () => {
  it('rafraîchit en attendant que le direct s’établisse', () => {
    const { transport, pollers, channel } = essai()
    transport.start()

    expect(channel.openings()).toBe(1)
    expect(pollers.fallback()?.running).toBe(true)
    expect(pollers.safetyNet()?.running).toBe(false)

    channel.say('connecting')
    expect(pollers.fallback()?.running).toBe(true)

    transport.stop()
  })

  it('laisse le direct porter le travail, avec un filet de loin en loin', () => {
    const { transport, pollers, channel, recus } = essai()
    transport.start()
    channel.say('live')

    expect(pollers.fallback()?.running).toBe(false)
    expect(pollers.safetyNet()?.running).toBe(true)

    channel.send('{"format":"meriz-mcd"}')
    expect(recus).toEqual(['{"format":"meriz-mcd"}'])

    transport.stop()
  })

  it('reprend le rafraîchissement quand le direct tombe', () => {
    const { transport, pollers, channel } = essai()
    transport.start()
    channel.say('live')
    channel.say('lost')

    expect(pollers.safetyNet()?.running).toBe(false)
    expect(pollers.fallback()?.running).toBe(true)

    transport.stop()
  })

  it('rebascule sur le direct quand la connexion revient', () => {
    const { transport, pollers, channel } = essai()
    transport.start()
    channel.say('live')
    channel.say('lost')
    channel.say('live')

    expect(pollers.fallback()?.running).toBe(false)
    expect(pollers.safetyNet()?.running).toBe(true)

    transport.stop()
  })

  it('ferme la connexion quand la page passe en arrière-plan, et la rouvre au retour', () => {
    const { transport, channel, visibility } = essai()
    transport.start()
    channel.say('live')
    expect(channel.openings()).toBe(1)

    visibility.set(true)
    expect(channel.closes()).toBe(1)

    visibility.set(false)
    expect(channel.openings()).toBe(2)

    transport.stop()
  })

  it('n’ouvre rien tant que la page est en arrière-plan', () => {
    const { transport, channel, pollers } = essai({ hidden: true })
    transport.start()

    expect(channel.openings()).toBe(0)
    // Le repli est démarré, mais c'est lui qui refuse d'appeler dans le vide.
    expect(pollers.fallback()?.running).toBe(true)

    transport.stop()
  })

  it('tout s’arrête et se ferme à la fin de la vue', () => {
    const { transport, pollers, channel, visibility } = essai()
    transport.start()
    channel.say('live')

    transport.stop()
    expect(channel.closes()).toBe(1)
    expect(pollers.fallback()?.running).toBe(false)
    expect(pollers.safetyNet()?.running).toBe(false)
    expect(visibility.listenerCount()).toBe(0)
  })

  it('ignore un modèle et un état qui arrivent après l’arrêt', () => {
    const { transport, pollers, channel, recus } = essai()
    transport.start()
    channel.say('live')
    transport.stop()

    channel.send('{"trop":"tard"}')
    channel.say('lost')

    expect(recus).toEqual([])
    expect(pollers.fallback()?.running).toBe(false)
    expect(pollers.safetyNet()?.running).toBe(false)
  })

  it('démarrer deux fois n’ouvre qu’une connexion', () => {
    const { transport, channel } = essai()
    transport.start()
    transport.start()

    expect(channel.openings()).toBe(1)

    transport.stop()
  })

  it('s’abonne au travail du bon élève', () => {
    const { transport, channel } = essai()
    transport.start()
    expect(channel.target()).toEqual({ assignmentId: '01JB', studentId: 12 })
    transport.stop()
  })
})
