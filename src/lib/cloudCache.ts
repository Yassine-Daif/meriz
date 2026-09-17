import type { StorageLike } from './documentStore'
import type { CloudDocument, CloudDocumentMeta } from './documentsApi'

/**
 * Cache local des documents du cloud, pour le compte connecté.
 *
 * Barrière anti-mélange : le cache porte un propriétaire unique et il
 * est vidé en entier à chaque changement de compte (reset). Il vit sous
 * son propre préfixe, sans aucun lien avec l'espace local d'avant compte.
 *
 * Les modifications pas encore envoyées au serveur sont marquées
 * « en attente ». Au moment d'un vidage, elles passent dans la boîte
 * d'envoi de leur propriétaire : une clé par compte, jamais affichée,
 * relue seulement pour ce même compte, après une connexion vérifiée.
 */

export const CACHE_PREFIX = 'meriz-cloud:'
const OWNER_KEY = `${CACHE_PREFIX}owner`
const DOC_PREFIX = `${CACHE_PREFIX}doc:`
/** Hors du préfixe du cache : un vidage ne l'efface pas. */
export const OUTBOX_PREFIX = 'meriz-cloud-outbox:'
const OUTBOX_VERSION = 1

export interface CachedDocument extends CloudDocumentMeta {
  /** Contenu connu, ou null si seule la ligne de liste est en cache. */
  content: string | null
  /** Contenu modifié ici, pas encore confirmé par le serveur. */
  pending: boolean
}

/** Modification non envoyée, mise de côté pour son seul propriétaire. */
export interface OutboxEntry {
  id: string
  name: string
  content: string
}

export interface CloudCache {
  owner: () => string | null
  /** Vide tout le cache, puis pose le nouveau propriétaire (null : personne). */
  reset: (ownerId: string | null) => void
  list: () => CachedDocument[]
  get: (id: string) => CachedDocument | null
  /** Liste du serveur : met à jour les lignes, garde le travail en attente. */
  replaceList: (metas: CloudDocumentMeta[]) => void
  putFromServer: (document: CloudDocument) => void
  /** Enregistre une modification locale, en attente d'envoi. false si le stockage refuse. */
  putLocalEdit: (meta: CloudDocumentMeta, content: string) => boolean
  /** Envoi confirmé. Reste en attente si le contenu a changé entre-temps. */
  markSynced: (id: string, sentContent: string, updatedAt: string) => void
  setMeta: (id: string, patch: Partial<CloudDocumentMeta>) => void
  remove: (id: string) => void
  pending: () => CachedDocument[]
  /** Met de côté le travail en attente pour le propriétaire actuel. Renvoie le nombre de documents. */
  stashPendingToOutbox: () => number
  /** Relit et vide la boîte d'envoi d'un compte vérifié. */
  takeOutbox: (userId: string) => OutboxEntry[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isCachedDocument(value: unknown): value is CachedDocument {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string' &&
    (value.content === null || typeof value.content === 'string') &&
    typeof value.pending === 'boolean'
  )
}

function isOutboxEntry(value: unknown): value is OutboxEntry {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.content === 'string'
  )
}

export function createCloudCache(storage: StorageLike): CloudCache {
  const read = (key: string): string | null => {
    try {
      return storage.getItem(key)
    } catch {
      return null
    }
  }
  const write = (key: string, value: string): boolean => {
    try {
      storage.setItem(key, value)
      return true
    } catch {
      return false
    }
  }
  const remove = (key: string): void => {
    try {
      storage.removeItem(key)
    } catch {
      // Clé impossible à retirer : sans conséquence pour la lecture suivante.
    }
  }
  const keysWithPrefix = (prefix: string): string[] => {
    const keys: string[] = []
    try {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index)
        if (key?.startsWith(prefix)) {
          keys.push(key)
        }
      }
    } catch {
      return keys
    }
    return keys
  }

  const getDoc = (id: string): CachedDocument | null => {
    const text = read(DOC_PREFIX + id)
    if (text === null) {
      return null
    }
    try {
      const raw: unknown = JSON.parse(text)
      return isCachedDocument(raw) ? raw : null
    } catch {
      return null
    }
  }
  const putDoc = (document: CachedDocument): boolean =>
    write(DOC_PREFIX + document.id, JSON.stringify(document))

  const list = (): CachedDocument[] =>
    keysWithPrefix(DOC_PREFIX)
      .map((key) => getDoc(key.slice(DOC_PREFIX.length)))
      .filter((document): document is CachedDocument => document !== null)

  const outboxKey = (userId: string) => OUTBOX_PREFIX + userId

  const readOutbox = (userId: string): OutboxEntry[] => {
    const text = read(outboxKey(userId))
    if (text === null) {
      return []
    }
    try {
      const raw: unknown = JSON.parse(text)
      if (!isRecord(raw) || raw.version !== OUTBOX_VERSION || !Array.isArray(raw.entries)) {
        return []
      }
      return raw.entries.filter(isOutboxEntry)
    } catch {
      return []
    }
  }

  return {
    owner: () => read(OWNER_KEY),

    reset: (ownerId) => {
      for (const key of keysWithPrefix(CACHE_PREFIX)) {
        remove(key)
      }
      if (ownerId !== null) {
        write(OWNER_KEY, ownerId)
      }
    },

    list,

    get: getDoc,

    replaceList: (metas) => {
      const serverIds = new Set(metas.map((meta) => meta.id))
      for (const cached of list()) {
        // Absent du serveur : supprimé ailleurs. Le travail en attente est
        // gardé, il sera recréé à l'envoi suivant.
        if (!serverIds.has(cached.id) && !cached.pending) {
          remove(DOC_PREFIX + cached.id)
        }
      }
      for (const meta of metas) {
        const cached = getDoc(meta.id)
        if (cached?.pending) {
          continue
        }
        // Contenu gardé seulement s'il correspond toujours à la version du serveur.
        const content = cached && cached.updatedAt === meta.updatedAt ? cached.content : null
        putDoc({ ...meta, content, pending: false })
      }
    },

    putFromServer: (document) => {
      putDoc({ ...document, pending: false })
    },

    putLocalEdit: (meta, content) => putDoc({ ...meta, content, pending: true }),

    markSynced: (id, sentContent, updatedAt) => {
      const cached = getDoc(id)
      if (!cached) {
        return
      }
      const unchanged = cached.content === sentContent
      putDoc({ ...cached, updatedAt, pending: unchanged ? false : cached.pending })
    },

    setMeta: (id, patch) => {
      const cached = getDoc(id)
      if (cached) {
        putDoc({ ...cached, ...patch, id })
      }
    },

    remove: (id) => remove(DOC_PREFIX + id),

    pending: () => list().filter((document) => document.pending && document.content !== null),

    stashPendingToOutbox: () => {
      const owner = read(OWNER_KEY)
      if (owner === null) {
        return 0
      }
      const pending = list().filter((document) => document.pending && document.content !== null)
      if (pending.length === 0) {
        return 0
      }
      const byId = new Map(readOutbox(owner).map((entry) => [entry.id, entry]))
      for (const document of pending) {
        byId.set(document.id, { id: document.id, name: document.name, content: document.content ?? '' })
      }
      const saved = write(
        outboxKey(owner),
        JSON.stringify({ version: OUTBOX_VERSION, entries: [...byId.values()] }),
      )
      return saved ? pending.length : 0
    },

    takeOutbox: (userId) => {
      const entries = readOutbox(userId)
      remove(outboxKey(userId))
      return entries
    },
  }
}
