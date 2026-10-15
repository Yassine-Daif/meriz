import { describe, expect, it } from 'vitest'
import type { StorageLike } from './documentStore'
import { eraseAccountTraces } from './accountErasure'

function fakeStorage(entries: Record<string, string>, failing = false): StorageLike & { map: Map<string, string> } {
  const map = new Map(Object.entries(entries))
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value)
    },
    removeItem: (key) => {
      if (failing) throw new Error('stockage indisponible')
      map.delete(key)
    },
    key: (index) => [...map.keys()][index] ?? null,
    get length() {
      return map.size
    },
  }
}

const traces = {
  'meriz-cloud-outbox:7': '[]',
  'meriz-work:7': '{}',
  'meriz-import-offered:7': '[]',
}

describe('effacer les traces d un compte supprimé', () => {
  it('retire la boîte d envoi, les liens de devoir et les imports proposés', () => {
    const storage = fakeStorage(traces)

    eraseAccountTraces(storage, '7')

    expect([...storage.map.keys()]).toEqual([])
  })

  // Un autre compte peut dormir dans ce navigateur, et l'espace local
  // d'avant compte n'appartient à personne : les deux restent.
  it('ne touche ni à un autre compte ni à l espace local', () => {
    const storage = fakeStorage({
      ...traces,
      'meriz-cloud-outbox:9': '[]',
      'meriz-work:9': '{}',
      'meriz-documents': '[]',
      'meriz-document:abc': '{}',
    })

    eraseAccountTraces(storage, '7')

    expect([...storage.map.keys()].sort()).toEqual([
      'meriz-cloud-outbox:9',
      'meriz-document:abc',
      'meriz-documents',
      'meriz-work:9',
    ])
  })

  it('ne casse pas quand le stockage refuse', () => {
    const storage = fakeStorage(traces, true)

    expect(() => eraseAccountTraces(storage, '7')).not.toThrow()
  })
})
