import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { McdEditorState } from '../model/mcdReducer'
import { DEFAULT_MPD_SETTINGS } from '../model/mpd'
import { clientCommande } from '../model/testFixtures'
import { createAccountController } from './accountController'
import type { AccountSpace } from './accountController'
import type { ApiClient } from './apiClient'
import { createCloudCache } from './cloudCache'
import { createCloudTestServer } from './cloudTestServer'
import type { DocumentRepository } from './documentRepository'
import { SEND_DELAY_MS } from './documentRepository'
import { createMemoryStorage } from './documentStore'

const stateOf = (x: number): McdEditorState => ({ mcd: clientCommande, layout: { 'ent-client': { x, y: 0 } } })

function setup() {
  const server = createCloudTestServer()
  const cache = createCloudCache(createMemoryStorage())
  const onExpired = vi.fn()
  // Comme le vrai client : un 401 reçu avec un jeton prévient la session.
  const createClient = (getToken: () => string | null, onUnauthorized: () => void): ApiClient => {
    const inner = server.clientFor(getToken)
    return {
      isConfigured: true,
      request: async (method, path, body) => {
        const hadToken = getToken() !== null
        const result = await inner.request(method, path, body)
        if (!result.ok && result.error.kind === 'unauthorized' && hadToken) onUnauthorized()
        return result
      },
    }
  }
  const controller = createAccountController({ cache, createClient, onExpired })
  return { server, cache, controller, onExpired }
}

function repositoryOf(space: AccountSpace): DocumentRepository {
  if (space.kind !== 'cloud') throw new Error(`espace inattendu : ${space.kind}`)
  return space.repository
}

async function editOffline(server: ReturnType<typeof createCloudTestServer>, repository: DocumentRepository, x: number) {
  const created = await repository.create('Doc', stateOf(0))
  if (!created.ok) throw new Error('création impossible')
  const opened = await repository.open(created.value.id)
  if (!opened.ok) throw new Error('ouverture impossible')
  const saver = repository.createSaver(opened.value)
  server.setOnline(false)
  saver.save(stateOf(x), DEFAULT_MPD_SETTINGS)
  await vi.advanceTimersByTimeAsync(SEND_DELAY_MS)
  return created.value.id
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('changement de compte, cache toujours vidé', () => {
  it("une connexion ouvre un cache neuf, sans les documents du compte précédent", async () => {
    const { server, cache, controller } = setup()
    const spaceA = controller.signedIn('1', server.tokenFor('1'))
    const repoA = repositoryOf(spaceA)
    await repoA.create('Secret de A')
    await repoA.list()

    const spaceB = controller.signedIn('2', server.tokenFor('2'))
    const listed = await repositoryOf(spaceB).list()

    expect(spaceB.key).toBe('user:2')
    expect(cache.owner()).toBe('2')
    expect(listed.ok && listed.value.documents).toEqual([])
    expect(cache.list()).toEqual([])
    // L'ancien dépôt est éteint.
    expect((await repoA.create('Tardif')).ok).toBe(false)
    expect(server.documentsOf('1').map((d) => d.name)).toEqual(['Secret de A'])
  })

  it("le client de l'ancien compte (classes, profil) n'envoie plus de jeton", async () => {
    const { server, controller } = setup()
    const spaceA = controller.signedIn('1', server.tokenFor('1'))
    if (spaceA.kind !== 'cloud') throw new Error('espace cloud attendu')
    controller.signedIn('2', server.tokenFor('2'))
    const before = server.requests.length

    const late = await spaceA.client.request('GET', '/documents?per_page=100&page=1')

    expect(late.ok ? null : late.error.kind).toBe('unauthorized')
    expect(server.requests.slice(before).map((r) => r.token)).toEqual([null])
  })

  it('la déconnexion vide le cache et éteint le dépôt', async () => {
    const { server, cache, controller } = setup()
    const repo = repositoryOf(controller.signedIn('1', server.tokenFor('1')))
    await repo.create('Doc')

    const stashed = await controller.signingOut(100)

    expect(stashed).toBe(0)
    expect(cache.owner()).toBeNull()
    expect(cache.list()).toEqual([])
    expect(repo.cachedList()).toEqual([])
  })

  it("au rechargement, garde le cache du même compte et vide celui d'un autre", async () => {
    const { server, cache, controller } = setup()
    const repo = repositoryOf(controller.signedIn('1', server.tokenFor('1')))
    await repo.create('Doc de 1')

    const same = repositoryOf(controller.restored('1', server.tokenFor('1')))
    expect(same.cachedList().map((d) => d.name)).toEqual(['Doc de 1'])

    const other = repositoryOf(controller.restored('2', server.tokenFor('2')))
    expect(other.cachedList()).toEqual([])
    expect(cache.owner()).toBe('2')
  })

  it("démarrage sans session : un ancien cache ne traîne pas", async () => {
    const { server, cache, controller } = setup()
    await repositoryOf(controller.signedIn('1', server.tokenFor('1'))).create('Doc')
    controller.dispose()

    controller.signedOutAtStartup()

    expect(cache.owner()).toBeNull()
    expect(cache.list()).toEqual([])
  })
})

describe("modifications non envoyées, jamais perdues ni partagées", () => {
  it("déconnexion hors ligne : mises de côté pour ce compte, reprises à son retour seulement", async () => {
    const { server, cache, controller } = setup()
    const repoA = repositoryOf(controller.signedIn('1', server.tokenFor('1')))
    const id = await editOffline(server, repoA, 77)

    const stashed = await controller.signingOut(100)
    expect(stashed).toBe(1)
    server.setOnline(true)

    const repoB = repositoryOf(controller.signedIn('2', server.tokenFor('2')))
    await repoB.syncPending()
    expect(repoB.pendingCount()).toBe(0)
    expect(cache.list()).toEqual([])
    expect(server.documentsOf('2')).toEqual([])
    await controller.signingOut(100)

    const repoA2 = repositoryOf(controller.signedIn('1', server.tokenFor('1')))
    expect(repoA2.pendingCount()).toBe(1)
    await repoA2.syncPending()

    expect(repoA2.pendingCount()).toBe(0)
    expect(JSON.parse(server.documents.get(id)?.content ?? '{}').layout).toEqual({ 'ent-client': { x: 77, y: 0 } })
  })

  it("session expirée : le travail en attente est mis de côté, le cache vidé", async () => {
    const { server, cache, controller, onExpired } = setup()
    const token = server.tokenFor('1')
    const repo = repositoryOf(controller.signedIn('1', token))
    await editOffline(server, repo, 5)
    server.setOnline(true)
    server.revoke(token)

    // Plusieurs requêtes peuvent recevoir le 401 : la session est prévenue
    // autant de fois, et doit ignorer les alertes suivantes.
    await repo.list()
    expect(onExpired).toHaveBeenCalled()

    expect(controller.expired()).toBe(1)
    expect(cache.owner()).toBeNull()
    expect(cache.list()).toEqual([])
    expect(cache.takeOutbox('1')).toHaveLength(1)
  })

  it("hors ligne au démarrage : le cache s'affiche, mais la boîte d'envoi attend une connexion vérifiée", async () => {
    const { server, cache, controller } = setup()
    const repo = repositoryOf(controller.signedIn('1', server.tokenFor('1')))
    await editOffline(server, repo, 3)
    await controller.signingOut(100)
    cache.reset('1')

    const offline = controller.restoredOffline(server.tokenFor('1'))

    expect(offline.kind).toBe('cloud')
    expect(repositoryOf(offline).pendingCount()).toBe(0)
    // La boîte est toujours là, intacte.
    expect(cache.takeOutbox('1')).toHaveLength(1)
  })

  it('hors ligne sans cache connu : état dédié, rien affiché', () => {
    const { controller } = setup()

    expect(controller.restoredOffline('jeton').kind).toBe('offline-unknown')
  })

  it("déconnexion en ligne : tout est envoyé avant de partir", async () => {
    const { server, controller } = setup()
    const repo = repositoryOf(controller.signedIn('1', server.tokenFor('1')))
    const created = await repo.create('Doc', stateOf(0))
    if (!created.ok) throw new Error('création impossible')
    const opened = await repo.open(created.value.id)
    if (!opened.ok) throw new Error('ouverture impossible')
    repo.createSaver(opened.value).save(stateOf(12), DEFAULT_MPD_SETTINGS)

    const stashed = await controller.signingOut(1000)

    expect(stashed).toBe(0)
    expect(JSON.parse(server.documents.get(created.value.id)?.content ?? '{}').layout).toEqual({
      'ent-client': { x: 12, y: 0 },
    })
  })
})
