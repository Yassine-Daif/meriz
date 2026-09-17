import { describe, expect, it } from 'vitest'
import { createCloudCache, OUTBOX_PREFIX } from './cloudCache'
import { createDocumentStore, createMemoryStorage } from './documentStore'

const meta = (id: string, updatedAt = '2026-09-17T10:00:00Z') => ({
  id,
  name: `Doc ${id}`,
  createdAt: '2026-09-17T09:00:00Z',
  updatedAt,
})

function allKeys(storage: ReturnType<typeof createMemoryStorage>): string[] {
  const keys: string[] = []
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key) keys.push(key)
  }
  return keys
}

describe('cloudCache, barrière anti-mélange', () => {
  it('vide tout le cache au changement de compte et pose le nouveau propriétaire', () => {
    const storage = createMemoryStorage()
    const cache = createCloudCache(storage)
    cache.reset('A')
    cache.putFromServer({ ...meta('a1'), content: '{}' })
    cache.putLocalEdit(meta('a2'), '{"x":1}')

    cache.reset('B')

    expect(cache.owner()).toBe('B')
    expect(cache.list()).toEqual([])
    expect(allKeys(storage).filter((key) => key.startsWith('meriz-cloud:'))).toEqual(['meriz-cloud:owner'])
  })

  it("ne touche jamais à l'espace local d'avant compte", () => {
    const storage = createMemoryStorage()
    const local = createDocumentStore(storage)
    const localMeta = local.createDocument('Mon travail local')!
    const cache = createCloudCache(storage)
    cache.reset('A')
    cache.putFromServer({ ...meta('a1'), content: '{}' })

    cache.reset(null)

    expect(cache.owner()).toBeNull()
    expect(local.listDocuments().map((m) => m.id)).toEqual([localMeta.id])
  })

  it('met à jour la liste en gardant le travail en attente', () => {
    const cache = createCloudCache(createMemoryStorage())
    cache.reset('A')
    cache.putFromServer({ ...meta('garde'), content: '{"v":1}' })
    cache.putFromServer({ ...meta('supprime'), content: '{}' })
    cache.putLocalEdit(meta('attente'), '{"local":true}')

    cache.replaceList([meta('garde'), meta('nouveau')])

    expect(cache.list().map((d) => d.id).sort()).toEqual(['attente', 'garde', 'nouveau'])
    expect(cache.get('garde')?.content).toBe('{"v":1}')
    expect(cache.get('attente')).toMatchObject({ pending: true, content: '{"local":true}' })
    expect(cache.get('nouveau')?.content).toBeNull()
  })

  it("oublie un contenu devenu périmé côté serveur", () => {
    const cache = createCloudCache(createMemoryStorage())
    cache.reset('A')
    cache.putFromServer({ ...meta('d1', '2026-09-17T10:00:00Z'), content: '{"v":1}' })

    cache.replaceList([meta('d1', '2026-09-17T11:00:00Z')])

    expect(cache.get('d1')?.content).toBeNull()
  })

  it("reste en attente si le contenu a changé pendant l'envoi", () => {
    const cache = createCloudCache(createMemoryStorage())
    cache.reset('A')
    cache.putLocalEdit(meta('d1'), '{"v":1}')
    cache.putLocalEdit(meta('d1'), '{"v":2}')

    cache.markSynced('d1', '{"v":1}', '2026-09-17T12:00:00Z')
    expect(cache.get('d1')?.pending).toBe(true)

    cache.markSynced('d1', '{"v":2}', '2026-09-17T12:00:01Z')
    expect(cache.get('d1')).toMatchObject({ pending: false, updatedAt: '2026-09-17T12:00:01Z' })
  })

  it('ignore une entrée corrompue sans planter', () => {
    const storage = createMemoryStorage()
    const cache = createCloudCache(storage)
    cache.reset('A')
    storage.setItem('meriz-cloud:doc:abime', '{pas du json')

    expect(cache.list()).toEqual([])
    expect(cache.get('abime')).toBeNull()
  })
})

describe("cloudCache, boîte d'envoi cloisonnée par compte", () => {
  it('met de côté le travail en attente pour son seul propriétaire', () => {
    const storage = createMemoryStorage()
    const cache = createCloudCache(storage)
    cache.reset('A')
    cache.putLocalEdit(meta('a1'), '{"de":"A"}')
    cache.putFromServer({ ...meta('a2'), content: '{"synchro":true}' })

    expect(cache.stashPendingToOutbox()).toBe(1)
    cache.reset('B')

    // Le compte B ne récupère rien, et ne vide pas la boîte de A.
    expect(cache.takeOutbox('B')).toEqual([])
    expect(storage.getItem(`${OUTBOX_PREFIX}A`)).not.toBeNull()
    expect(cache.list()).toEqual([])

    // Seul A la reprend, une fois.
    expect(cache.takeOutbox('A')).toEqual([{ id: 'a1', name: 'Doc a1', content: '{"de":"A"}' }])
    expect(cache.takeOutbox('A')).toEqual([])
  })

  it('survit au vidage du cache et fusionne les envois successifs', () => {
    const cache = createCloudCache(createMemoryStorage())
    cache.reset('A')
    cache.putLocalEdit(meta('a1'), '{"v":1}')
    cache.stashPendingToOutbox()
    cache.reset(null)
    cache.reset('A')
    cache.putLocalEdit(meta('a1'), '{"v":2}')
    cache.putLocalEdit(meta('a3'), '{"v":3}')
    cache.stashPendingToOutbox()

    expect(cache.takeOutbox('A')).toEqual([
      { id: 'a1', name: 'Doc a1', content: '{"v":2}' },
      { id: 'a3', name: 'Doc a3', content: '{"v":3}' },
    ])
  })

  it('ne met rien de côté sans propriétaire', () => {
    const cache = createCloudCache(createMemoryStorage())
    cache.reset(null)
    cache.putLocalEdit(meta('x'), '{}')

    expect(cache.stashPendingToOutbox()).toBe(0)
  })
})
