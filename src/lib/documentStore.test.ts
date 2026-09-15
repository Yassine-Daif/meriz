import { describe, expect, it } from 'vitest'
import type { McdEditorState } from '../model/mcdReducer'
import type { MpdSettings } from '../model/mpd'
import { DEFAULT_MPD_SETTINGS } from '../model/mpd'
import { clientCommande, inscription } from '../model/testFixtures'
import {
  createDocumentStore,
  createMemoryStorage,
  ENTRY_PREFIX,
  INDEX_KEY,
  LEGACY_AUTOSAVE_KEY,
  LEGACY_MPD_SETTINGS_KEY,
} from './documentStore'
import type { StorageLike } from './documentStore'
import { serializeModel } from './persistence'

const postgres: MpdSettings = { dialect: 'postgresql', overrides: { 'prop-num-client': 'BIGINT' } }

function stateOf(mcd: McdEditorState['mcd']): McdEditorState {
  return { mcd, layout: { 'ent-client': { x: 10, y: 20 } } }
}

/** Store déterministe : horloge qui avance d'une seconde, ids numérotés. */
function makeStore(storage: StorageLike = createMemoryStorage()) {
  let seconds = 0
  let ids = 0
  const store = createDocumentStore(storage, {
    now: () => new Date(Date.UTC(2026, 8, 15, 10, 0, seconds++)),
    createId: () => `doc-${++ids}`,
  })
  return { store, storage }
}

function storedKeys(storage: StorageLike): string[] {
  const keys: string[] = []
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key) keys.push(key)
  }
  return keys
}

describe('documentStore, cycle de vie', () => {
  it('crée des documents et les liste du plus récemment modifié au plus ancien', () => {
    const { store } = makeStore()
    const first = store.createDocument('Premier')
    const second = store.createDocument('Second')

    expect(store.listDocuments().map((m) => m.name)).toEqual(['Second', 'Premier'])

    store.saveContent(first!.id, stateOf(clientCommande), DEFAULT_MPD_SETTINGS)
    expect(store.listDocuments().map((m) => m.id)).toEqual([first!.id, second!.id])
  })

  it('crée un document vide avec les réglages MPD par défaut', () => {
    const { store } = makeStore()
    const meta = store.createDocument('Vide')
    const opened = store.loadDocument(meta!.id)

    expect(opened?.state.mcd).toEqual({ properties: [], entities: [], associations: [] })
    expect(opened?.mpdSettings).toEqual(DEFAULT_MPD_SETTINGS)
  })

  it('enregistre le contenu et met à jour la date de modification', () => {
    const { store } = makeStore()
    const meta = store.createDocument('Doc')!
    expect(store.saveContent(meta.id, stateOf(clientCommande), postgres)).toBe(true)

    const opened = store.loadDocument(meta.id)
    expect(opened?.state).toEqual(stateOf(clientCommande))
    expect(opened?.mpdSettings).toEqual(postgres)
    expect(opened!.meta.updatedAt > meta.updatedAt).toBe(true)
    expect(opened!.meta.createdAt).toBe(meta.createdAt)
  })

  it('renomme un document, nom nettoyé, et refuse un nom vide', () => {
    const { store } = makeStore()
    const meta = store.createDocument('Ancien', stateOf(clientCommande))!

    expect(store.renameDocument(meta.id, '  Nouveau nom  ')?.name).toBe('Nouveau nom')
    expect(store.loadDocument(meta.id)?.meta.name).toBe('Nouveau nom')
    expect(store.loadDocument(meta.id)?.state).toEqual(stateOf(clientCommande))
    expect(store.renameDocument(meta.id, '   ')).toBeNull()
  })

  it('duplique un document : nouvel identifiant, même contenu, nom suffixé', () => {
    const { store } = makeStore()
    const meta = store.createDocument('Modèle', stateOf(inscription), postgres)!
    const copy = store.duplicateDocument(meta.id)!

    expect(copy.id).not.toBe(meta.id)
    expect(copy.name).toBe('Modèle (copie)')
    expect(store.loadDocument(copy.id)?.state).toEqual(stateOf(inscription))
    expect(store.loadDocument(copy.id)?.mpdSettings).toEqual(postgres)
  })

  it("supprime un document : l'entrée et la ligne d'index disparaissent", () => {
    const { store, storage } = makeStore()
    const kept = store.createDocument('Gardé')!
    const removed = store.createDocument('Supprimé')!

    expect(store.deleteDocument(removed.id)).toBe(true)
    expect(store.listDocuments().map((m) => m.id)).toEqual([kept.id])
    expect(store.loadDocument(removed.id)).toBeNull()
    expect(storage.getItem(ENTRY_PREFIX + removed.id)).toBeNull()
    expect(store.deleteDocument('inconnu')).toBe(false)
  })

  it('propose « Nouveau document », puis un nom numéroté', () => {
    const { store } = makeStore()
    expect(store.nextNewDocumentName()).toBe('Nouveau document')
    store.createDocument('Nouveau document')
    expect(store.nextNewDocumentName()).toBe('Nouveau document 2')
    store.createDocument('Nouveau document 2')
    expect(store.nextNewDocumentName()).toBe('Nouveau document 3')
  })
})

describe('documentStore, stockage abîmé', () => {
  it("reconstruit un index illisible depuis les entrées, sans rien perdre", () => {
    const { store, storage } = makeStore()
    store.createDocument('Alpha', stateOf(clientCommande))
    store.createDocument('Beta')
    storage.setItem(INDEX_KEY, '{ceci nest pas du JSON')

    expect(store.listDocuments().map((m) => m.name).sort()).toEqual(['Alpha', 'Beta'])
    expect(() => JSON.parse(storage.getItem(INDEX_KEY)!)).not.toThrow()
  })

  it("reconstruit un index d'une version inconnue", () => {
    const { store, storage } = makeStore()
    store.createDocument('Alpha')
    storage.setItem(INDEX_KEY, JSON.stringify({ version: 99, documents: [] }))

    expect(store.listDocuments().map((m) => m.name)).toEqual(['Alpha'])
  })

  it('écarte les métadonnées mal formées de la liste', () => {
    const { store, storage } = makeStore()
    const meta = store.createDocument('Valide')!
    const index = JSON.parse(storage.getItem(INDEX_KEY)!)
    index.documents.push({ id: 42, name: null })
    storage.setItem(INDEX_KEY, JSON.stringify(index))

    expect(store.listDocuments().map((m) => m.id)).toEqual([meta.id])
  })

  it("garde un document illisible : listé, impossible à ouvrir, jamais effacé d'office", () => {
    const { store, storage } = makeStore()
    const meta = store.createDocument('Abîmé')!
    storage.setItem(ENTRY_PREFIX + meta.id, 'contenu corrompu')

    expect(store.listDocuments().map((m) => m.id)).toEqual([meta.id])
    expect(store.loadDocument(meta.id)).toBeNull()
    expect(storage.getItem(ENTRY_PREFIX + meta.id)).toBe('contenu corrompu')
    expect(store.deleteDocument(meta.id)).toBe(true)
  })

  it('ne lève jamais quand le stockage refuse les écritures', () => {
    const storage = createMemoryStorage()
    const refusing: StorageLike = {
      get length() {
        return storage.length
      },
      key: (index) => storage.key(index),
      getItem: (key) => storage.getItem(key),
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
      removeItem: (key) => storage.removeItem(key),
    }
    const { store } = makeStore(refusing)

    expect(store.createDocument('Impossible')).toBeNull()
    expect(store.listDocuments()).toEqual([])
  })

  it("ne laisse pas d'entrée orpheline si l'index ne peut pas être écrit", () => {
    const storage = createMemoryStorage()
    const indexRefused: StorageLike = {
      get length() {
        return storage.length
      },
      key: (index) => storage.key(index),
      getItem: (key) => storage.getItem(key),
      setItem: (key, value) => {
        if (key === INDEX_KEY) throw new Error('QuotaExceededError')
        storage.setItem(key, value)
      },
      removeItem: (key) => storage.removeItem(key),
    }
    const { store } = makeStore(indexRefused)

    expect(store.createDocument('Orphelin')).toBeNull()
    expect(storedKeys(storage).filter((key) => key.startsWith(ENTRY_PREFIX))).toEqual([])
  })
})

describe('documentStore, migration du plan de travail unique', () => {
  it("convertit l'ancienne sauvegarde en « Mon document » et retire les anciennes clés", () => {
    const { store, storage } = makeStore()
    storage.setItem(LEGACY_AUTOSAVE_KEY, serializeModel(stateOf(clientCommande), postgres))
    storage.setItem(LEGACY_MPD_SETTINGS_KEY, JSON.stringify(DEFAULT_MPD_SETTINGS))

    const meta = store.migrateLegacyAutosave()

    expect(meta?.name).toBe('Mon document')
    expect(store.loadDocument(meta!.id)?.state).toEqual(stateOf(clientCommande))
    expect(store.loadDocument(meta!.id)?.mpdSettings).toEqual(postgres)
    expect(storage.getItem(LEGACY_AUTOSAVE_KEY)).toBeNull()
    expect(storage.getItem(LEGACY_MPD_SETTINGS_KEY)).toBeNull()
  })

  it("reprend les réglages MPD de l'ancienne clé quand la sauvegarde n'en porte pas", () => {
    const { store, storage } = makeStore()
    const withoutMpd = JSON.parse(serializeModel(stateOf(clientCommande), DEFAULT_MPD_SETTINGS))
    delete withoutMpd.mpd
    storage.setItem(LEGACY_AUTOSAVE_KEY, JSON.stringify(withoutMpd))
    storage.setItem(LEGACY_MPD_SETTINGS_KEY, JSON.stringify(postgres))

    const meta = store.migrateLegacyAutosave()
    expect(store.loadDocument(meta!.id)?.mpdSettings).toEqual(postgres)
  })

  it('ne migre pas une sauvegarde vide, et la laisse en place', () => {
    const { store, storage } = makeStore()
    const empty = serializeModel(
      { mcd: { properties: [], entities: [], associations: [] }, layout: {} },
      DEFAULT_MPD_SETTINGS,
    )
    storage.setItem(LEGACY_AUTOSAVE_KEY, empty)

    expect(store.migrateLegacyAutosave()).toBeNull()
    expect(store.listDocuments()).toEqual([])
    expect(storage.getItem(LEGACY_AUTOSAVE_KEY)).toBe(empty)
  })

  it('ne migre plus une fois des documents présents', () => {
    const { store, storage } = makeStore()
    store.createDocument('Déjà là')
    storage.setItem(LEGACY_AUTOSAVE_KEY, serializeModel(stateOf(clientCommande), postgres))

    expect(store.migrateLegacyAutosave()).toBeNull()
    expect(store.listDocuments().map((m) => m.name)).toEqual(['Déjà là'])
  })

  it("ne perd pas l'ancienne sauvegarde si l'écriture du document échoue", () => {
    const storage = createMemoryStorage()
    const legacy = serializeModel(stateOf(clientCommande), postgres)
    storage.setItem(LEGACY_AUTOSAVE_KEY, legacy)
    const refusing: StorageLike = {
      get length() {
        return storage.length
      },
      key: (index) => storage.key(index),
      getItem: (key) => storage.getItem(key),
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
      removeItem: (key) => storage.removeItem(key),
    }
    const { store } = makeStore(refusing)

    expect(store.migrateLegacyAutosave()).toBeNull()
    expect(storage.getItem(LEGACY_AUTOSAVE_KEY)).toBe(legacy)
  })
})
