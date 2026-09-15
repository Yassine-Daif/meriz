import type { DocumentMeta, OpenedDocument } from '../model/document'
import { emptyEditorState } from '../model/document'
import type { McdEditorState } from '../model/mcdReducer'
import { DEFAULT_MPD_SETTINGS } from '../model/mpd'
import type { MpdSettings } from '../model/mpd'
import { parseModelFile, parseMpdSettings, serializeModel } from './persistence'
import { newId } from './id'

/**
 * Stockage local des documents : un index des métadonnées, plus une
 * entrée par document au format fichier Meriz (v2, nom compris). Le
 * même contrôle de forme sert donc aux fichiers et au stockage.
 *
 * Aucune méthode ne lève d'exception : un stockage plein, corrompu ou
 * d'une version inconnue est ignoré proprement, et une entrée de
 * document n'est jamais effacée sans action explicite.
 */

/** Sous-ensemble de l'API Storage utilisé, pour tester sans navigateur. */
export interface StorageLike {
  readonly length: number
  key: (index: number) => string | null
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

export interface DocumentStore {
  /** false : stockage en mémoire, perdu à la fermeture de la page. */
  readonly isPersistent: boolean
  listDocuments: () => DocumentMeta[]
  loadDocument: (id: string) => OpenedDocument | null
  createDocument: (
    name: string,
    state?: McdEditorState,
    mpdSettings?: MpdSettings,
  ) => DocumentMeta | null
  saveContent: (id: string, state: McdEditorState, mpdSettings: MpdSettings) => boolean
  renameDocument: (id: string, name: string) => DocumentMeta | null
  duplicateDocument: (id: string) => DocumentMeta | null
  deleteDocument: (id: string) => boolean
  nextNewDocumentName: () => string
  migrateLegacyAutosave: () => DocumentMeta | null
}

export const INDEX_KEY = 'meriz-documents'
export const ENTRY_PREFIX = 'meriz-document:'
const INDEX_VERSION = 1
export const LEGACY_AUTOSAVE_KEY = 'meriz-autosave'
export const LEGACY_MPD_SETTINGS_KEY = 'meriz-mpd-settings'
const NEW_DOCUMENT_NAME = 'Nouveau document'
const MIGRATED_DOCUMENT_NAME = 'Mon document'
const UNNAMED_DOCUMENT_NAME = 'Document sans nom'

interface StoreOptions {
  isPersistent?: boolean
  now?: () => Date
  createId?: () => string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isDocumentMeta(value: unknown): value is DocumentMeta {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    value.id !== '' &&
    typeof value.name === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  )
}

export function createDocumentStore(storage: StorageLike, options: StoreOptions = {}): DocumentStore {
  const now = () => (options.now ?? (() => new Date()))().toISOString()
  const createId = options.createId ?? newId

  /* Accès protégés : le stockage peut refuser lecture ou écriture. */
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
      // Rien à faire : la clé restera, sans conséquence pour la liste.
    }
  }
  const entryKeys = (): string[] => {
    const keys: string[] = []
    try {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index)
        if (key?.startsWith(ENTRY_PREFIX)) {
          keys.push(key)
        }
      }
    } catch {
      return keys
    }
    return keys
  }

  const writeIndex = (documents: DocumentMeta[]): boolean =>
    write(INDEX_KEY, JSON.stringify({ version: INDEX_VERSION, documents }))

  /**
   * Index illisible ou de version inconnue : on le reconstruit depuis
   * les entrées présentes, sans jamais en effacer une.
   */
  const rebuildIndex = (): DocumentMeta[] => {
    const timestamp = now()
    const documents: DocumentMeta[] = []
    for (const key of entryKeys()) {
      const text = read(key)
      const parsed = text === null ? null : parseModelFile(text)
      if (parsed?.ok) {
        documents.push({
          id: key.slice(ENTRY_PREFIX.length),
          name: parsed.name ?? UNNAMED_DOCUMENT_NAME,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
      }
    }
    if (documents.length > 0) {
      writeIndex(documents)
    }
    return documents
  }

  /** Métadonnées connues, dont l'entrée existe encore. */
  const metas = (): DocumentMeta[] => {
    const text = read(INDEX_KEY)
    if (text === null) {
      return entryKeys().length > 0 ? rebuildIndex() : []
    }
    let raw: unknown
    try {
      raw = JSON.parse(text)
    } catch {
      return rebuildIndex()
    }
    if (!isRecord(raw) || raw.version !== INDEX_VERSION || !Array.isArray(raw.documents)) {
      return rebuildIndex()
    }
    return raw.documents
      .filter(isDocumentMeta)
      .filter((meta) => read(ENTRY_PREFIX + meta.id) !== null)
  }

  const createDocument: DocumentStore['createDocument'] = (
    name,
    state = emptyEditorState(),
    mpdSettings = DEFAULT_MPD_SETTINGS,
  ) => {
    const timestamp = now()
    const meta: DocumentMeta = { id: createId(), name, createdAt: timestamp, updatedAt: timestamp }
    const existing = metas()
    if (!write(ENTRY_PREFIX + meta.id, serializeModel(state, mpdSettings, name))) {
      return null
    }
    if (!writeIndex([...existing, meta])) {
      // Pas d'entrée orpheline : l'index n'a pas pu la référencer.
      remove(ENTRY_PREFIX + meta.id)
      return null
    }
    return meta
  }

  const loadDocument: DocumentStore['loadDocument'] = (id) => {
    const meta = metas().find((m) => m.id === id)
    const text = read(ENTRY_PREFIX + id)
    if (!meta || text === null) {
      return null
    }
    const parsed = parseModelFile(text)
    if (!parsed.ok) {
      return null
    }
    return { meta, state: parsed.state, mpdSettings: parsed.mpdSettings ?? DEFAULT_MPD_SETTINGS }
  }

  const updateMeta = (id: string, patch: Partial<DocumentMeta>): DocumentMeta | null => {
    const documents = metas()
    const index = documents.findIndex((m) => m.id === id)
    const current = documents[index]
    if (!current) {
      return null
    }
    const updated = { ...current, ...patch, updatedAt: now() }
    documents[index] = updated
    return writeIndex(documents) ? updated : null
  }

  return {
    isPersistent: options.isPersistent ?? true,

    listDocuments: () => [...metas()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),

    loadDocument,

    createDocument,

    saveContent: (id, state, mpdSettings) => {
      const meta = metas().find((m) => m.id === id)
      if (!meta || !write(ENTRY_PREFIX + id, serializeModel(state, mpdSettings, meta.name))) {
        return false
      }
      return updateMeta(id, {}) !== null
    },

    renameDocument: (id, name) => {
      const trimmed = name.trim()
      const opened = loadDocument(id)
      if (trimmed === '' || !opened) {
        return null
      }
      if (!write(ENTRY_PREFIX + id, serializeModel(opened.state, opened.mpdSettings, trimmed))) {
        return null
      }
      return updateMeta(id, { name: trimmed })
    },

    duplicateDocument: (id) => {
      const opened = loadDocument(id)
      return opened
        ? createDocument(`${opened.meta.name} (copie)`, opened.state, opened.mpdSettings)
        : null
    },

    deleteDocument: (id) => {
      const documents = metas()
      if (!documents.some((m) => m.id === id)) {
        return false
      }
      remove(ENTRY_PREFIX + id)
      return writeIndex(documents.filter((m) => m.id !== id))
    },

    nextNewDocumentName: () => {
      const used = new Set(metas().map((m) => m.name.toLowerCase()))
      if (!used.has(NEW_DOCUMENT_NAME.toLowerCase())) {
        return NEW_DOCUMENT_NAME
      }
      let n = 2
      while (used.has(`${NEW_DOCUMENT_NAME} ${n}`.toLowerCase())) {
        n += 1
      }
      return `${NEW_DOCUMENT_NAME} ${n}`
    },

    /**
     * Avant les documents, un seul plan de travail était sauvegardé.
     * Au premier lancement (aucun index, aucune entrée), il devient
     * « Mon document ». Les anciennes clés ne sont retirées qu'une fois
     * le document écrit : rien n'est perdu si l'écriture échoue.
     */
    migrateLegacyAutosave: () => {
      if (read(INDEX_KEY) !== null || entryKeys().length > 0) {
        return null
      }
      const text = read(LEGACY_AUTOSAVE_KEY)
      const parsed = text === null ? null : parseModelFile(text)
      if (!parsed?.ok) {
        return null
      }
      const { mcd } = parsed.state
      if (mcd.properties.length === 0 && mcd.entities.length === 0 && mcd.associations.length === 0) {
        return null
      }
      let legacySettings: MpdSettings | null = null
      try {
        const settingsText = read(LEGACY_MPD_SETTINGS_KEY)
        legacySettings = settingsText === null ? null : parseMpdSettings(JSON.parse(settingsText))
      } catch {
        legacySettings = null
      }
      const meta = createDocument(
        MIGRATED_DOCUMENT_NAME,
        parsed.state,
        parsed.mpdSettings ?? legacySettings ?? DEFAULT_MPD_SETTINGS,
      )
      if (meta) {
        remove(LEGACY_AUTOSAVE_KEY)
        remove(LEGACY_MPD_SETTINGS_KEY)
      }
      return meta
    },
  }
}

/** Stockage en mémoire : repli sans navigateur, et base des tests. */
export function createMemoryStorage(): StorageLike {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
    removeItem: (key) => {
      values.delete(key)
    },
  }
}

/**
 * Stockage du navigateur si accessible (localStorage). Sinon, par
 * exemple en navigation privée stricte, repli en mémoire : l'application
 * reste utilisable, mais rien ne survit à la fermeture de la page.
 */
export function browserDocumentStore(): DocumentStore {
  try {
    const storage = window.localStorage
    const probeKey = 'meriz-storage-probe'
    storage.setItem(probeKey, '1')
    storage.removeItem(probeKey)
    return createDocumentStore(storage)
  } catch {
    return createDocumentStore(createMemoryStorage(), { isPersistent: false })
  }
}
