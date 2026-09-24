import type { ApiClient } from './apiClient'
import type { SaveStatus } from './documentRepository'
import { createStatusBox, MAX_WAIT_MS, RETRY_DELAYS_MS, SEND_DELAY_MS } from './documentRepository'
import { updateLesson } from './lessonsApi'
import type { Lesson } from './lessonsApi'

/**
 * Sauvegarde automatique d'un cours : même cadence que celle des
 * documents et des devoirs, attente après la dernière modification,
 * envoi forcé au bout du délai maximal, reprise après une panne réseau.
 *
 * Le titre et la page de blocs partent ensemble, dans un seul PATCH.
 */

export interface LessonSaverOptions {
  client: ApiClient
  lessonId: string
  /** Titre déjà enregistré, pour ne pas renvoyer l'identique. */
  initialTitle: string
  /** Page déjà enregistrée, même raison. */
  initialBlocks: string
}

export interface LessonSaver {
  /** À appeler à chaque modification : l'envoi est différé. */
  save: (title: string, blocks: string) => void
  /** Force l'envoi. false si le travail n'a pas pu partir. */
  flush: () => Promise<boolean>
  retry: () => void
  getStatus: () => SaveStatus
  subscribe: (listener: (status: SaveStatus) => void) => () => void
  /** Cours renvoyé par le serveur au dernier envoi réussi. */
  onSaved: (listener: (lesson: Lesson) => void) => () => void
  dispose: () => void
}

const GONE_MESSAGE =
  "Ce cours n'existe plus sur le serveur. Vos dernières modifications ne peuvent plus être enregistrées."

export function createLessonSaver(options: LessonSaverOptions): LessonSaver {
  const { client, lessonId } = options
  let lastQueued = { title: options.initialTitle, blocks: options.initialBlocks }
  let unsent: { title: string; blocks: string } | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let firstChangeAt: number | null = null
  let retryIndex = 0
  let disposed = false
  let gone = false
  const box = createStatusBox({ kind: 'saved' })
  const savedListeners = new Set<(lesson: Lesson) => void>()

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  const schedule = (delay: number) => {
    clearTimer()
    timer = setTimeout(() => {
      timer = null
      void send()
    }, delay)
  }

  const send = async (): Promise<boolean> => {
    if (disposed || gone || unsent === null) {
      return true
    }
    const payload = unsent
    box.set({ kind: 'saving' })
    const result = await updateLesson(client, lessonId, payload)
    if (disposed) {
      return true
    }
    if (result.ok) {
      firstChangeAt = null
      retryIndex = 0
      for (const listener of savedListeners) listener(result.value)
      if (unsent === payload) {
        unsent = null
        box.set({ kind: 'saved' })
        return true
      }
      // La page a changé pendant l'envoi : on repart pour un tour.
      schedule(SEND_DELAY_MS)
      return false
    }
    const error = result.error
    if (error.kind === 'not_found') {
      gone = true
      clearTimer()
      box.set({ kind: 'error', message: GONE_MESSAGE })
      return false
    }
    if (error.kind === 'network' || error.kind === 'server' || error.kind === 'rate_limited') {
      box.set({ kind: 'offline' })
      schedule(RETRY_DELAYS_MS[Math.min(retryIndex, RETRY_DELAYS_MS.length - 1)] ?? 30_000)
      retryIndex += 1
      return false
    }
    box.set({ kind: 'error', message: `Échec de l'envoi : ${error.message}` })
    return false
  }

  return {
    save: (title, blocks) => {
      if (disposed || gone) return
      if (title === lastQueued.title && blocks === lastQueued.blocks) return
      lastQueued = { title, blocks }
      unsent = lastQueued
      if (box.get().kind !== 'offline') {
        box.set({ kind: 'saving' })
      }
      // Envoi différé, mais jamais repoussé au-delà du délai maximal.
      const now = Date.now()
      if (firstChangeAt === null) firstChangeAt = now
      const wait = Math.max(0, Math.min(SEND_DELAY_MS, firstChangeAt + MAX_WAIT_MS - now))
      schedule(wait)
    },

    flush: async () => {
      for (let round = 0; round < 3; round += 1) {
        clearTimer()
        if (unsent === null) return true
        if (await send()) return true
        if (box.get().kind !== 'saving') return false
      }
      return unsent === null
    },

    retry: () => {
      if (disposed || gone || unsent === null) return
      retryIndex = 0
      schedule(0)
    },

    getStatus: () => box.get(),
    subscribe: box.subscribe,

    onSaved: (listener) => {
      savedListeners.add(listener)
      return () => {
        savedListeners.delete(listener)
      }
    },

    dispose: () => {
      disposed = true
      clearTimer()
      box.clear()
      savedListeners.clear()
    },
  }
}
