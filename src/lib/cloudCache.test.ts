import { describe, expect, it } from 'vitest'
import { CACHE_PREFIX, createCloudCache, OUTBOX_PREFIX } from './cloudCache'
import { createDocumentStore, createMemoryStorage } from './documentStore'

const meta = (id: string, updatedAt = '2026-09-17T10:00:00Z') => ({
  id,
  name: `Doc ${id}`,
  assignmentId: null,
  groupId: null,
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

describe('cloudCache, provenance des documents', () => {
  it('garde le devoir et le groupe posés par la liste du serveur', () => {
    const cache = createCloudCache(createMemoryStorage())
    cache.reset('A')

    cache.replaceList([
      { ...meta('travail'), assignmentId: '01JDEVOIR' },
      { ...meta('perso') },
    ])

    expect(cache.get('travail')).toMatchObject({ assignmentId: '01JDEVOIR', groupId: null })
    expect(cache.get('perso')).toMatchObject({ assignmentId: null, groupId: null })
  })

  it('pose la provenance sur une entrée en attente sans toucher son nom ni son contenu', () => {
    const cache = createCloudCache(createMemoryStorage())
    cache.reset('A')
    cache.putLocalEdit({ ...meta('travail'), name: 'Nom local' }, '{"local":true}')

    cache.replaceList([{ ...meta('travail'), name: 'Nom du serveur', assignmentId: '01JDEVOIR' }])

    expect(cache.get('travail')).toMatchObject({
      name: 'Nom local',
      content: '{"local":true}',
      pending: true,
      assignmentId: '01JDEVOIR',
    })
  })

  it('relit une entrée écrite par une version d’avant, provenance inconnue donc nulle', () => {
    const storage = createMemoryStorage()
    const cache = createCloudCache(storage)
    cache.reset('A')
    // Forme d'avant le transport de la provenance : les deux champs manquent.
    storage.setItem(
      `${CACHE_PREFIX}doc:ancien`,
      JSON.stringify({
        id: 'ancien',
        name: 'Doc ancien',
        createdAt: '2026-09-17T09:00:00Z',
        updatedAt: '2026-09-17T10:00:00Z',
        content: '{"hors":"ligne"}',
        pending: true,
      }),
    )

    expect(cache.get('ancien')).toMatchObject({ assignmentId: null, groupId: null })
  })

  it('ne perd jamais le contenu en attente d’une entrée écrite par une version d’avant', () => {
    const storage = createMemoryStorage()
    const cache = createCloudCache(storage)
    cache.reset('A')
    storage.setItem(
      `${CACHE_PREFIX}doc:ancien`,
      JSON.stringify({
        id: 'ancien',
        name: 'Doc ancien',
        createdAt: '2026-09-17T09:00:00Z',
        updatedAt: '2026-09-17T10:00:00Z',
        content: '{"jamais":"envoye"}',
        pending: true,
      }),
    )

    // Aucune version de schéma : le travail hors ligne part encore dans la
    // boîte d'envoi, au lieu d'être jeté avec le cache.
    expect(cache.pending().map((d) => d.id)).toEqual(['ancien'])
    expect(cache.stashPendingToOutbox()).toBe(1)
    expect(cache.takeOutbox('A')).toEqual([
      { id: 'ancien', name: 'Doc ancien', content: '{"jamais":"envoye"}' },
    ])
  })
})
