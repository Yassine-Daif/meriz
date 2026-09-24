import { describe, expect, it } from 'vitest'
import { createMemoryStorage } from './documentStore'
import type { StorageLike } from './documentStore'
import { createWorkLinks, WORK_PREFIX } from './workDocuments'

/** Stockage qui refuse d'écrire, comme un navigateur en navigation privée. */
function refusingStorage(): StorageLike {
  return {
    length: 0,
    key: () => null,
    getItem: () => null,
    setItem: () => {
      throw new Error('quota')
    },
    removeItem: () => {
      throw new Error('quota')
    },
  }
}

describe('lien entre un devoir et le document de travail', () => {
  it('retrouve le document lié à un devoir', () => {
    const links = createWorkLinks(createMemoryStorage(), '7')

    expect(links.get('01JB')).toBeNull()
    expect(links.set('01JB', '01DOC')).toBe(true)

    expect(links.get('01JB')).toBe('01DOC')
    expect(links.get('01JC')).toBeNull()
  })

  it('garde un lien par devoir', () => {
    const links = createWorkLinks(createMemoryStorage(), '7')

    links.set('01JB', '01DOC')
    links.set('01JC', '01AUTRE')
    links.set('01JB', '01REMPLACE')

    expect(links.get('01JB')).toBe('01REMPLACE')
    expect(links.get('01JC')).toBe('01AUTRE')
  })

  it('ne montre jamais le lien d’un autre compte', () => {
    const storage = createMemoryStorage()
    const mine = createWorkLinks(storage, '7')
    const theirs = createWorkLinks(storage, '8')

    mine.set('01JB', '01DOC')

    expect(theirs.get('01JB')).toBeNull()
    expect(storage.getItem(`${WORK_PREFIX}7`)).not.toBeNull()
    expect(storage.getItem(`${WORK_PREFIX}8`)).toBeNull()
  })

  it('oublie un lien, et ne garde rien quand il ne reste plus rien', () => {
    const storage = createMemoryStorage()
    const links = createWorkLinks(storage, '7')
    links.set('01JB', '01DOC')

    expect(links.clear('01JB')).toBe(true)

    expect(links.get('01JB')).toBeNull()
    expect(storage.getItem(`${WORK_PREFIX}7`)).toBeNull()
    // Oublier un lien absent ne change rien et ne casse rien.
    expect(links.clear('01JC')).toBe(true)
  })

  it('traite un contenu illisible comme une absence de lien', () => {
    const storage = createMemoryStorage()
    storage.setItem(`${WORK_PREFIX}7`, 'pas du JSON')
    const links = createWorkLinks(storage, '7')

    expect(links.get('01JB')).toBeNull()

    storage.setItem(`${WORK_PREFIX}7`, JSON.stringify({ '01JB': 42 }))
    expect(links.get('01JB')).toBeNull()
  })

  it('reste utilisable quand le stockage refuse', () => {
    const links = createWorkLinks(refusingStorage(), '7')

    expect(links.set('01JB', '01DOC')).toBe(false)
    expect(links.get('01JB')).toBeNull()
  })
})
