import type { DocumentMeta, OpenedDocument } from '../model/document'
import { emptyEditorState } from '../model/document'
import type { McdEditorState } from '../model/mcdReducer'
import { DEFAULT_MPD_SETTINGS } from '../model/mpd'
import type { MpdSettings } from '../model/mpd'
import type { ApiClient, ApiError, Outcome } from './apiClient'
import { apiError } from './apiClient'
import type { CloudCache, OutboxEntry } from './cloudCache'
import {
  createCloudDocument,
  deleteCloudDocument,
  getCloudDocument,
  listAllDocuments,
  updateCloudDocument,
} from './documentsApi'
import type { CloudDocumentMeta } from './documentsApi'
import type { DocumentStore } from './documentStore'
import { parseModelFile, serializeModel } from './persistence'

/**
 * Dépôt de documents : une même interface pour l'espace local (sans
 * compte, inchangé) et pour le cloud du compte connecté (source de
 * vérité, avec un cache local de travail).
 */

export type SaveStatus =
  | { kind: 'saved' }
  | { kind: 'saving' }
  /** Serveur injoignable : modifications gardées sur l'appareil, nouvel essai prévu. */
  | { kind: 'offline' }
  | { kind: 'error'; message: string }

/** Sauvegarde automatique d'un document ouvert. */
export interface DocumentSaver {
  save: (state: McdEditorState, mpdSettings: MpdSettings) => void
  /** Envoie ce qui attend. true si tout est enregistré. */
  flush: () => Promise<boolean>
  retry: () => void
  /** Le document a été renommé : le nom inscrit dans le contenu suit. */
  rename: (name: string) => void
  getStatus: () => SaveStatus
  subscribe: (listener: (status: SaveStatus) => void) => () => void
  dispose: () => void
}

export interface ListResult {
  documents: DocumentMeta[]
  /** Serveur injoignable : la liste vient du cache. */
  offline: ApiError | null
  pendingCount: number
}

export interface OpenResult {
  document: OpenedDocument
  /** Version du cache (hors ligne, ou modifications en attente). */
  fromCache: boolean
  /** Des modifications de cette version attendent encore l'envoi. */
  pending: boolean
}

export interface DocumentRepository {
  readonly kind: 'local' | 'cloud'
  /** Liste immédiate, sans réseau. */
  cachedList: () => DocumentMeta[]
  list: () => Promise<Outcome<ListResult>>
  open: (id: string) => Promise<Outcome<OpenResult>>
  create: (name: string, state?: McdEditorState, mpdSettings?: MpdSettings) => Promise<Outcome<DocumentMeta>>
  rename: (id: string, name: string) => Promise<Outcome<DocumentMeta>>
  duplicate: (id: string) => Promise<Outcome<DocumentMeta>>
  remove: (id: string) => Promise<Outcome<void>>
  createSaver: (opened: OpenResult) => DocumentSaver
  nextNewDocumentName: () => string
  pendingCount: () => number
  /** Envoie les modifications en attente (cloud). */
  syncPending: () => Promise<void>
  /** Avant une déconnexion : tente d'envoyer tout ce qui attend, dans un délai borné. */
  flushAll: (timeoutMs: number) => Promise<void>
  /** Reprend la boîte d'envoi du compte, déjà vérifié par le serveur. */
  adoptOutbox: (entries: OutboxEntry[]) => void
  dispose: () => void
}

const NEW_DOCUMENT_NAME = 'Nouveau document'

/** « Nouveau document », puis « Nouveau document 2 », etc. */
export function nextNewName(existingNames: string[]): string {
  const used = new Set(existingNames.map((name) => name.toLowerCase()))
  if (!used.has(NEW_DOCUMENT_NAME.toLowerCase())) {
    return NEW_DOCUMENT_NAME
  }
  let n = 2
  while (used.has(`${NEW_DOCUMENT_NAME} ${n}`.toLowerCase())) {
    n += 1
  }
  return `${NEW_DOCUMENT_NAME} ${n}`
}

function byMostRecent(a: DocumentMeta, b: DocumentMeta): number {
  return b.updatedAt.localeCompare(a.updatedAt)
}

function ok<T>(value: T): Outcome<T> {
  return { ok: true, value }
}

function fail<T>(error: ApiError): Outcome<T> {
  return { ok: false, error }
}

/** Petit observable de statut, pour l'indicateur de sauvegarde. */
function createStatusBox(initial: SaveStatus) {
  let status = initial
  const listeners = new Set<(status: SaveStatus) => void>()
  return {
    get: () => status,
    set: (next: SaveStatus) => {
      status = next
      for (const listener of listeners) listener(next)
    },
    subscribe: (listener: (status: SaveStatus) => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    clear: () => listeners.clear(),
  }
}

/* ------------------------------------------------------------------ */
/* Espace local, sans compte                                           */

const LOCAL_STORAGE_ERROR = apiError(
  'storage',
  null,
  "Le document n'a pas pu être enregistré dans ce navigateur (stockage plein ou indisponible).",
)
const LOCAL_UNREADABLE = apiError(
  'storage',
  null,
  "Ce document est illisible et n'a pas pu être ouvert. Il reste conservé dans le navigateur.",
)
const LOCAL_SAVE_FAILED = 'Sauvegarde locale impossible (stockage plein ?). Enregistrez le document en fichier.'

export function createLocalRepository(store: DocumentStore): DocumentRepository {
  return {
    kind: 'local',
    cachedList: () => store.listDocuments(),
    list: async () => ok({ documents: store.listDocuments(), offline: null, pendingCount: 0 }),
    open: async (id) => {
      const document = store.loadDocument(id)
      return document ? ok({ document, fromCache: false, pending: false }) : fail(LOCAL_UNREADABLE)
    },
    create: async (name, state, mpdSettings) => {
      const meta = store.createDocument(name, state, mpdSettings)
      return meta ? ok(meta) : fail(LOCAL_STORAGE_ERROR)
    },
    rename: async (id, name) => {
      const meta = store.renameDocument(id, name)
      return meta ? ok(meta) : fail(LOCAL_STORAGE_ERROR)
    },
    duplicate: async (id) => {
      const meta = store.duplicateDocument(id)
      return meta ? ok(meta) : fail(LOCAL_STORAGE_ERROR)
    },
    remove: async (id) => (store.deleteDocument(id) ? ok(undefined) : fail(LOCAL_STORAGE_ERROR)),

    // Même règle qu'avant les comptes : on n'écrit que si le contenu a
    // réellement changé, pour ne pas modifier la date d'un document ouvert.
    createSaver: ({ document }) => {
      const id = document.meta.id
      let lastSaved = serializeModel(document.state, document.mpdSettings)
      let lastAttempt: { state: McdEditorState; mpdSettings: MpdSettings } | null = null
      const box = createStatusBox({ kind: 'saved' })
      const attempt = () => {
        if (!lastAttempt) return
        const content = serializeModel(lastAttempt.state, lastAttempt.mpdSettings)
        if (content === lastSaved) {
          box.set({ kind: 'saved' })
          return
        }
        if (store.saveContent(id, lastAttempt.state, lastAttempt.mpdSettings)) {
          lastSaved = content
          box.set({ kind: 'saved' })
        } else {
          box.set({ kind: 'error', message: LOCAL_SAVE_FAILED })
        }
      }
      return {
        save: (state, mpdSettings) => {
          lastAttempt = { state, mpdSettings }
          attempt()
        },
        flush: async () => box.get().kind !== 'error',
        retry: attempt,
        rename: () => {},
        getStatus: box.get,
        subscribe: box.subscribe,
        dispose: box.clear,
      }
    },
    nextNewDocumentName: () => store.nextNewDocumentName(),
    pendingCount: () => 0,
    syncPending: async () => {},
    flushAll: async () => {},
    adoptOutbox: () => {},
    dispose: () => {},
  }
}

/* ------------------------------------------------------------------ */
/* Cloud du compte connecté                                            */

/** Délai après la dernière modification avant l'envoi. */
export const SEND_DELAY_MS = 1500
/** Au plus tard, même si l'on tape sans arrêt (60 écritures par minute côté serveur). */
export const MAX_WAIT_MS = 10_000
/** Nouvelles tentatives quand le serveur est injoignable. */
export const RETRY_DELAYS_MS = [2000, 5000, 15_000, 30_000]

const STALE_ACCOUNT = apiError('unauthorized', null, 'Le compte a changé : action annulée.')
const CLOUD_UNREADABLE = apiError(
  'unexpected',
  null,
  "Le contenu de ce document est illisible. Il n'a pas été modifié sur le serveur.",
)
const EMPTY_NAME = apiError('validation', null, 'Le nom ne peut pas être vide.')

function isTransient(error: ApiError): boolean {
  return error.kind === 'network' || error.kind === 'server' || error.kind === 'rate_limited'
}

function toMeta(document: CloudDocumentMeta): DocumentMeta {
  return {
    id: document.id,
    name: document.name,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  }
}

function fromContent(meta: DocumentMeta, content: string): OpenedDocument | null {
  const parsed = parseModelFile(content)
  if (!parsed.ok) {
    return null
  }
  return { meta, state: parsed.state, mpdSettings: parsed.mpdSettings ?? DEFAULT_MPD_SETTINGS }
}

/** Réécrit le nom inscrit dans le contenu (copie, récupération). */
function withName(content: string, name: string): string {
  try {
    const raw: unknown = JSON.parse(content)
    if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
      return JSON.stringify({ ...raw, name }, null, 2)
    }
  } catch {
    // Contenu illisible : il part tel quel, le serveur le garde intact.
  }
  return content
}

interface CloudRepositoryOptions {
  /** Client lié au jeton de ce compte, éteint quand le compte change. */
  client: ApiClient
  cache: CloudCache
  /** Identifiant du compte, tel que renvoyé par le serveur. */
  userId: string
}

export function createCloudRepository({ client, cache, userId }: CloudRepositoryOptions): DocumentRepository {
  let alive = true
  const savers = new Set<{
    id: string
    retry: () => void
    flush: () => Promise<boolean>
    rename: (name: string) => void
    dispose: () => void
  }>()
  const inFlight = new Set<string>()
  /** Documents disparus du serveur pendant qu'ils sont ouverts : récupérés à la fermeture. */
  const detached = new Set<string>()

  // Garde de compte : ce dépôt n'agit que tant qu'il est le dépôt du
  // propriétaire actuel du cache.
  const isCurrent = () => alive && cache.owner() === userId

  const cachedList = (): DocumentMeta[] =>
    isCurrent() ? cache.list().map(toMeta).sort(byMostRecent) : []

  const pendingCount = () => (isCurrent() ? cache.pending().length : 0)

  /** Envoie une modification en attente. Document disparu : recréé « (récupéré) ». */
  const sendPending = async (entry: { id: string; name: string; content: string }): Promise<'sent' | 'transient' | 'failed'> => {
    if (!isCurrent() || inFlight.has(entry.id)) {
      return 'transient'
    }
    inFlight.add(entry.id)
    try {
      const updated = await updateCloudDocument(client, entry.id, { content: entry.content })
      if (!isCurrent()) return 'transient'
      if (updated.ok) {
        cache.markSynced(entry.id, entry.content, updated.value.updatedAt)
        return 'sent'
      }
      if (updated.error.kind === 'not_found') {
        const name = `${entry.name} (récupéré)`
        const created = await createCloudDocument(client, { name, content: withName(entry.content, name) })
        if (!isCurrent()) return 'transient'
        if (created.ok) {
          cache.remove(entry.id)
          cache.putFromServer(created.value)
          return 'sent'
        }
        return isTransient(created.error) ? 'transient' : 'failed'
      }
      return isTransient(updated.error) ? 'transient' : 'failed'
    } finally {
      inFlight.delete(entry.id)
    }
  }

  const syncPending = async (): Promise<void> => {
    if (!isCurrent()) return
    for (const document of cache.pending()) {
      if (detached.has(document.id) || document.content === null) continue
      const result = await sendPending({ id: document.id, name: document.name, content: document.content })
      if (result === 'transient') return
    }
  }

  const onOnline = () => {
    for (const saver of savers) saver.retry()
    void syncPending()
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('online', onOnline)
  }

  /**
   * Contenu d'un document : les modifications en attente d'abord (plus
   * récentes que le serveur), sinon le serveur, sinon le cache hors ligne.
   */
  const loadContent = async (
    id: string,
  ): Promise<Outcome<{ meta: DocumentMeta; content: string; source: 'pending' | 'server' | 'cache' }>> => {
    const cached = cache.get(id)
    if (cached?.pending && cached.content !== null) {
      return ok({ meta: toMeta(cached), content: cached.content, source: 'pending' })
    }
    const fetched = await getCloudDocument(client, id)
    if (!isCurrent()) return fail(STALE_ACCOUNT)
    if (fetched.ok) {
      cache.putFromServer(fetched.value)
      return ok({ meta: toMeta(fetched.value), content: fetched.value.content, source: 'server' })
    }
    if (isTransient(fetched.error) && cached?.content) {
      return ok({ meta: toMeta(cached), content: cached.content, source: 'cache' })
    }
    return fail(fetched.error)
  }

  const createSaver = (opened: OpenResult): DocumentSaver => {
    const { document } = opened
    const id = document.meta.id
    const createdAt = document.meta.createdAt
    let name = document.meta.name
    let lastQueued = serializeModel(document.state, document.mpdSettings, name)
    let unsent: string | null = opened.pending ? (cache.get(id)?.content ?? lastQueued) : null
    let timer: ReturnType<typeof setTimeout> | undefined
    let firstChangeAt: number | null = null
    let retryIndex = 0
    let disposed = false
    let storageRefused = false
    const box = createStatusBox(unsent === null ? { kind: 'saved' } : { kind: 'saving' })

    const clearTimer = () => {
      if (timer !== undefined) {
        clearTimeout(timer)
        timer = undefined
      }
    }
    const schedule = (delay: number) => {
      clearTimer()
      timer = setTimeout(() => {
        timer = undefined
        void send()
      }, delay)
    }

    /** true quand plus rien n'attend. */
    const send = async (): Promise<boolean> => {
      if (disposed || !isCurrent() || detached.has(id)) return false
      if (unsent === null) {
        box.set({ kind: 'saved' })
        return true
      }
      if (inFlight.has(id)) {
        schedule(500)
        return false
      }
      const content = unsent
      firstChangeAt = null
      box.set({ kind: 'saving' })
      inFlight.add(id)
      const result = await updateCloudDocument(client, id, { content }).finally(() => inFlight.delete(id))
      if (disposed || !isCurrent()) return false

      if (result.ok) {
        cache.markSynced(id, content, result.value.updatedAt)
        retryIndex = 0
        if (unsent === content) {
          unsent = null
          box.set({ kind: 'saved' })
          return true
        }
        // Modifié pendant l'envoi : la nouvelle version suit.
        schedule(SEND_DELAY_MS)
        return false
      }
      if (isTransient(result.error)) {
        box.set(
          storageRefused
            ? { kind: 'error', message: `${result.error.message} Stockage local plein : enregistrez le document en fichier.` }
            : { kind: 'offline' },
        )
        const delay = RETRY_DELAYS_MS[Math.min(retryIndex, RETRY_DELAYS_MS.length - 1)] ?? 30_000
        retryIndex += 1
        schedule(delay)
        return false
      }
      if (result.error.kind === 'not_found') {
        // Supprimé ailleurs pendant l'édition : on garde tout en cache, et
        // le document sera recréé une seule fois, à la fermeture.
        detached.add(id)
        box.set({
          kind: 'error',
          message: `Ce document n'existe plus sur le serveur. Vos modifications sont gardées : elles seront enregistrées sous « ${name} (récupéré) » en revenant à vos documents.`,
        })
        return false
      }
      box.set({ kind: 'error', message: `Échec de l'envoi : ${result.error.message}` })
      return false
    }

    const saver = {
      id,
      save: (state: McdEditorState, mpdSettings: MpdSettings) => {
        if (disposed || !isCurrent()) return
        const content = serializeModel(state, mpdSettings, name)
        if (content === lastQueued) return
        lastQueued = content
        unsent = content
        const current = cache.get(id)
        storageRefused = !cache.putLocalEdit(
          { id, name, createdAt, updatedAt: current?.updatedAt ?? document.meta.updatedAt },
          content,
        )
        if (detached.has(id)) return
        const now = Date.now()
        firstChangeAt ??= now
        const wait = Math.max(0, Math.min(SEND_DELAY_MS, firstChangeAt + MAX_WAIT_MS - now))
        if (box.get().kind !== 'offline') {
          box.set({ kind: 'saving' })
        }
        schedule(wait)
      },
      flush: async () => {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          clearTimer()
          if (unsent === null) return true
          if (await send()) return true
          if (box.get().kind !== 'saving') return false
        }
        return unsent === null
      },
      retry: () => {
        if (disposed || detached.has(id)) return
        retryIndex = 0
        if (unsent !== null) void send()
      },
      rename: (newName: string) => {
        name = newName
      },
      getStatus: box.get,
      subscribe: box.subscribe,
      dispose: () => {
        disposed = true
        clearTimer()
        box.clear()
        savers.delete(saver)
        // Fermé : un document disparu peut maintenant être récupéré.
        detached.delete(id)
      },
    }
    savers.add(saver)
    if (unsent !== null) {
      schedule(0)
    }
    return saver
  }

  return {
    kind: 'cloud',
    cachedList,

    list: async () => {
      if (!isCurrent()) return fail(STALE_ACCOUNT)
      await syncPending()
      const listed = await listAllDocuments(client)
      if (!isCurrent()) return fail(STALE_ACCOUNT)
      if (listed.ok) {
        cache.replaceList(listed.value)
        return ok({ documents: cachedList(), offline: null, pendingCount: pendingCount() })
      }
      if (isTransient(listed.error)) {
        return ok({ documents: cachedList(), offline: listed.error, pendingCount: pendingCount() })
      }
      return fail(listed.error)
    },

    open: async (id) => {
      if (!isCurrent()) return fail(STALE_ACCOUNT)
      const loaded = await loadContent(id)
      if (!loaded.ok) {
        if (loaded.error.kind === 'not_found') cache.remove(id)
        return loaded
      }
      const document = fromContent(loaded.value.meta, loaded.value.content)
      if (!document) return fail(CLOUD_UNREADABLE)
      return ok({
        document,
        fromCache: loaded.value.source !== 'server',
        pending: loaded.value.source === 'pending',
      })
    },

    create: async (name, state = emptyEditorState(), mpdSettings = DEFAULT_MPD_SETTINGS) => {
      if (!isCurrent()) return fail(STALE_ACCOUNT)
      const created = await createCloudDocument(client, {
        name,
        content: serializeModel(state, mpdSettings, name),
      })
      if (!created.ok) return created
      if (!isCurrent()) return fail(STALE_ACCOUNT)
      cache.putFromServer(created.value)
      return ok(toMeta(created.value))
    },

    rename: async (id, name) => {
      const trimmed = name.trim()
      if (trimmed === '') return fail(EMPTY_NAME)
      if (!isCurrent()) return fail(STALE_ACCOUNT)
      const updated = await updateCloudDocument(client, id, { name: trimmed })
      if (!updated.ok) return updated
      if (!isCurrent()) return fail(STALE_ACCOUNT)
      cache.setMeta(id, { name: updated.value.name, updatedAt: updated.value.updatedAt })
      for (const saver of savers) {
        if (saver.id === id) saver.rename(updated.value.name)
      }
      return ok(toMeta(updated.value))
    },

    duplicate: async (id) => {
      if (!isCurrent()) return fail(STALE_ACCOUNT)
      const loaded = await loadContent(id)
      if (!loaded.ok) return loaded
      const name = `${loaded.value.meta.name} (copie)`
      const created = await createCloudDocument(client, { name, content: withName(loaded.value.content, name) })
      if (!created.ok) return created
      if (!isCurrent()) return fail(STALE_ACCOUNT)
      cache.putFromServer(created.value)
      return ok(toMeta(created.value))
    },

    remove: async (id) => {
      if (!isCurrent()) return fail(STALE_ACCOUNT)
      const deleted = await deleteCloudDocument(client, id)
      if (!deleted.ok && deleted.error.kind !== 'not_found') return deleted
      if (isCurrent()) cache.remove(id)
      return ok(undefined)
    },

    createSaver,

    nextNewDocumentName: () => nextNewName(cachedList().map((meta) => meta.name)),

    pendingCount,

    syncPending,

    flushAll: async (timeoutMs) => {
      if (!isCurrent()) return
      let timer: ReturnType<typeof setTimeout> | undefined
      const deadline = new Promise<void>((resolve) => {
        timer = setTimeout(resolve, timeoutMs)
      })
      const work = (async () => {
        await Promise.all([...savers].map((saver) => saver.flush()))
        await syncPending()
      })()
      await Promise.race([work, deadline])
      clearTimeout(timer)
    },

    adoptOutbox: (entries) => {
      if (!isCurrent()) return
      const now = new Date().toISOString()
      for (const entry of entries) {
        const cached = cache.get(entry.id)
        cache.putLocalEdit(
          {
            id: entry.id,
            name: entry.name,
            createdAt: cached?.createdAt ?? now,
            updatedAt: cached?.updatedAt ?? now,
          },
          entry.content,
        )
      }
    },

    dispose: () => {
      alive = false
      for (const saver of [...savers]) saver.dispose()
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', onOnline)
      }
    },
  }
}
