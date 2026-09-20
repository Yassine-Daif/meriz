import type { McdEditorState } from '../model/mcdReducer'
import type { MpdSettings } from '../model/mpd'
import type { ApiClient } from './apiClient'
import type { AssignmentField } from './assignmentsApi'
import { updateAssignment } from './assignmentsApi'
import type { DocumentSaver } from './documentRepository'
import { createStatusBox, MAX_WAIT_MS, RETRY_DELAYS_MS, SEND_DELAY_MS } from './documentRepository'
import { serializeModel } from './persistence'

/**
 * Sauvegarde automatique de la base ou du corrigé d'un devoir. Même
 * interface et même cadence que celle des documents : l'éditeur ne voit
 * aucune différence. Le contenu part dans le champ du devoir concerné.
 */

export interface AssignmentSaverOptions {
  client: ApiClient
  assignmentId: string
  field: AssignmentField
  /** Titre du devoir : écrit dans le modèle, pour l'export fichier. */
  title: string
  /** Contenu déjà enregistré, pour ne pas renvoyer l'identique. */
  initialContent: string | null
}

const GONE_MESSAGE =
  "Ce devoir n'existe plus sur le serveur. Vos dernières modifications ne peuvent plus être enregistrées."

export function createAssignmentSaver(options: AssignmentSaverOptions): DocumentSaver {
  const { client, assignmentId, field } = options
  let title = options.title
  let lastQueued = options.initialContent
  let unsent: string | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let firstChangeAt: number | null = null
  let retryIndex = 0
  let disposed = false
  let gone = false
  const box = createStatusBox({ kind: 'saved' })

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
    const content = unsent
    box.set({ kind: 'saving' })
    const patch = field === 'base' ? { baseContent: content } : { solutionContent: content }
    const result = await updateAssignment(client, assignmentId, patch)
    if (disposed) {
      return true
    }
    if (result.ok) {
      firstChangeAt = null
      retryIndex = 0
      if (unsent === content) {
        unsent = null
        box.set({ kind: 'saved' })
        return true
      }
      // Le contenu a changé pendant l'envoi : on repart pour un tour.
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

  const saver: DocumentSaver = {
    save: (state: McdEditorState, mpdSettings: MpdSettings) => {
      if (disposed || gone) return
      const content = serializeModel(state, mpdSettings, title)
      if (content === lastQueued) return
      lastQueued = content
      unsent = content
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

    rename: (name: string) => {
      title = name
    },

    getStatus: () => box.get(),
    subscribe: box.subscribe,

    dispose: () => {
      disposed = true
      clearTimer()
      box.clear()
    },
  }

  return saver
}
