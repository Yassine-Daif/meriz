import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { McdEditorState } from '../model/mcdReducer'
import { DEFAULT_MPD_SETTINGS } from '../model/mpd'
import { clientCommande, inscription } from '../model/testFixtures'
import { createCloudCache } from './cloudCache'
import { createCloudTestServer } from './cloudTestServer'
import {
  createCloudRepository,
  createInertSaver,
  createLocalRepository,
  MAX_WAIT_MS,
  RETRY_DELAYS_MS,
  SEND_DELAY_MS,
} from './documentRepository'
import type { DocumentRepository } from './documentRepository'
import { createDocumentStore, createMemoryStorage } from './documentStore'
import { parseModelFile, serializeModel } from './persistence'
import { createWorkLinks } from './workDocuments'

const stateOf = (mcd: McdEditorState['mcd'], x = 0): McdEditorState => ({
  mcd,
  layout: { 'ent-client': { x, y: 0 } },
})

/** Un appareil : un stockage, un cache cloud, un faux serveur partagé. */
function setup() {
  const server = createCloudTestServer()
  const storage = createMemoryStorage()
  const cache = createCloudCache(storage)
  let token: string | null = null
  const client = server.clientFor(() => token)
  const signIn = (userId: string): DocumentRepository => {
    cache.reset(userId)
    token = server.tokenFor(userId)
    return createCloudRepository({ client, cache, userId, workLinks: createWorkLinks(storage, userId) })
  }
  return { server, storage, cache, client, signIn, signOut: () => { token = null } }
}

function contentModel(content: string) {
  const parsed = parseModelFile(content)
  return parsed.ok ? parsed.state : null
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('dépôt cloud, opérations', () => {
  it('crée, liste, ouvre, renomme, duplique et supprime sur le serveur', async () => {
    const { signIn, server, cache } = setup()
    const repo = signIn('A')

    const created = await repo.create('Commandes', stateOf(clientCommande))
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const id = created.value.id

    const listed = await repo.list()
    expect(listed.ok && listed.value.documents.map((d) => d.name)).toEqual(['Commandes'])

    const opened = await repo.open(id)
    expect(opened.ok && opened.value.document.state).toEqual(stateOf(clientCommande))
    expect(opened.ok && opened.value.fromCache).toBe(false)

    expect((await repo.rename(id, '  Ventes  ')).ok).toBe(true)
    expect(server.documents.get(id)?.name).toBe('Ventes')
    expect(cache.get(id)?.name).toBe('Ventes')

    const copy = await repo.duplicate(id)
    expect(copy.ok && copy.value.name).toBe('Ventes (copie)')

    expect((await repo.remove(id)).ok).toBe(true)
    expect(server.documents.has(id)).toBe(false)
    expect(cache.get(id)).toBeNull()
    expect(repo.nextNewDocumentName()).toBe('Nouveau document')
  })

  it('refuse les actions de gestion hors ligne, avec un message clair', async () => {
    const { signIn, server } = setup()
    const repo = signIn('A')
    server.setOnline(false)

    const created = await repo.create('Hors ligne')

    expect(created.ok ? null : created.error.kind).toBe('network')
  })

  it('montre la liste du cache quand le serveur est injoignable', async () => {
    const { signIn, server } = setup()
    const repo = signIn('A')
    await repo.create('Gardé en cache')
    server.setOnline(false)

    const listed = await repo.list()

    expect(listed.ok && listed.value.offline?.kind).toBe('network')
    expect(listed.ok && listed.value.documents.map((d) => d.name)).toEqual(['Gardé en cache'])
  })

  it('ouvre la version du cache hors ligne', async () => {
    const { signIn, server } = setup()
    const repo = signIn('A')
    const created = await repo.create('Doc', stateOf(inscription))
    if (!created.ok) throw new Error('création impossible')
    server.setOnline(false)

    const opened = await repo.open(created.value.id)

    expect(opened.ok && opened.value).toMatchObject({ fromCache: true, pending: false })
    expect(opened.ok && opened.value.document.state).toEqual(stateOf(inscription))
  })
})

describe('dépôt cloud, sauvegarde automatique', () => {
  async function openNew(repo: DocumentRepository) {
    const created = await repo.create('Doc', stateOf(clientCommande))
    if (!created.ok) throw new Error('création impossible')
    const opened = await repo.open(created.value.id)
    if (!opened.ok) throw new Error('ouverture impossible')
    return { id: created.value.id, opened: opened.value }
  }

  it("regroupe les modifications et n'envoie qu'après une pause", async () => {
    const { signIn, server } = setup()
    const repo = signIn('A')
    const { id, opened } = await openNew(repo)
    const saver = repo.createSaver(opened)
    const patchesBefore = server.requests.filter((r) => r.method === 'PATCH').length

    saver.save(stateOf(clientCommande, 1), DEFAULT_MPD_SETTINGS)
    saver.save(stateOf(clientCommande, 2), DEFAULT_MPD_SETTINGS)
    saver.save(stateOf(clientCommande, 3), DEFAULT_MPD_SETTINGS)
    expect(saver.getStatus().kind).toBe('saving')
    await vi.advanceTimersByTimeAsync(SEND_DELAY_MS - 10)
    expect(server.requests.filter((r) => r.method === 'PATCH').length).toBe(patchesBefore)

    await vi.advanceTimersByTimeAsync(20)

    expect(server.requests.filter((r) => r.method === 'PATCH').length).toBe(patchesBefore + 1)
    expect(contentModel(server.documents.get(id)?.content ?? '')).toEqual(stateOf(clientCommande, 3))
    expect(saver.getStatus().kind).toBe('saved')
  })

  it("envoie au plus tard après le délai maximal, même en tapant sans arrêt", async () => {
    const { signIn, server } = setup()
    const repo = signIn('A')
    const { opened } = await openNew(repo)
    const saver = repo.createSaver(opened)
    const patches = () => server.requests.filter((r) => r.method === 'PATCH').length
    const before = patches()

    for (let step = 1; step <= Math.ceil(MAX_WAIT_MS / 1000) + 1; step += 1) {
      saver.save(stateOf(clientCommande, step), DEFAULT_MPD_SETTINGS)
      await vi.advanceTimersByTimeAsync(1000)
    }

    expect(patches()).toBeGreaterThan(before)
  })

  it("ne perd rien hors ligne, puis envoie au retour du serveur", async () => {
    const { signIn, server, cache } = setup()
    const repo = signIn('A')
    const { id, opened } = await openNew(repo)
    const saver = repo.createSaver(opened)
    server.setOnline(false)

    saver.save(stateOf(clientCommande, 9), DEFAULT_MPD_SETTINGS)
    await vi.advanceTimersByTimeAsync(SEND_DELAY_MS)

    expect(saver.getStatus().kind).toBe('offline')
    expect(cache.get(id)?.pending).toBe(true)
    expect(contentModel(cache.get(id)?.content ?? '')).toEqual(stateOf(clientCommande, 9))

    server.setOnline(true)
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0] ?? 2000)

    expect(saver.getStatus().kind).toBe('saved')
    expect(cache.get(id)?.pending).toBe(false)
    expect(contentModel(server.documents.get(id)?.content ?? '')).toEqual(stateOf(clientCommande, 9))
  })

  it("rouvre les modifications en attente plutôt que la version du serveur", async () => {
    const { signIn, server, cache, client, storage } = setup()
    const repo = signIn('A')
    const { id, opened } = await openNew(repo)
    const saver = repo.createSaver(opened)
    server.setOnline(false)
    saver.save(stateOf(clientCommande, 42), DEFAULT_MPD_SETTINGS)
    await vi.advanceTimersByTimeAsync(SEND_DELAY_MS)
    saver.dispose()
    repo.dispose()

    // Rechargement de la page : nouveau dépôt, même compte, même cache.
    server.setOnline(true)
    const again = createCloudRepository({ client, cache, userId: 'A', workLinks: createWorkLinks(storage, 'A') })
    const reopened = await again.open(id)

    expect(reopened.ok && reopened.value).toMatchObject({ fromCache: true, pending: true })
    expect(reopened.ok && reopened.value.document.state).toEqual(stateOf(clientCommande, 42))

    if (!reopened.ok) return
    again.createSaver(reopened.value)
    await vi.advanceTimersByTimeAsync(10)
    expect(contentModel(server.documents.get(id)?.content ?? '')).toEqual(stateOf(clientCommande, 42))
    expect(cache.get(id)?.pending).toBe(false)
  })

  it('vide la file et confirme avec flush', async () => {
    const { signIn, server } = setup()
    const repo = signIn('A')
    const { id, opened } = await openNew(repo)
    const saver = repo.createSaver(opened)

    saver.save(stateOf(clientCommande, 5), DEFAULT_MPD_SETTINGS)
    expect(await saver.flush()).toBe(true)

    expect(contentModel(server.documents.get(id)?.content ?? '')).toEqual(stateOf(clientCommande, 5))
  })

  it('flush renvoie false hors ligne, sans rien perdre', async () => {
    const { signIn, server, cache } = setup()
    const repo = signIn('A')
    const { id, opened } = await openNew(repo)
    const saver = repo.createSaver(opened)
    server.setOnline(false)

    saver.save(stateOf(clientCommande, 6), DEFAULT_MPD_SETTINGS)

    expect(await saver.flush()).toBe(false)
    expect(cache.get(id)?.pending).toBe(true)
  })

  it('document supprimé ailleurs : modifications gardées puis récupérées une seule fois', async () => {
    const { signIn, server } = setup()
    const repo = signIn('A')
    const { id, opened } = await openNew(repo)
    const saver = repo.createSaver(opened)
    server.documents.delete(id)

    saver.save(stateOf(clientCommande, 7), DEFAULT_MPD_SETTINGS)
    await vi.advanceTimersByTimeAsync(SEND_DELAY_MS)
    expect(saver.getStatus().kind).toBe('error')

    // Toujours ouvert : aucune récupération, pour éviter les copies multiples.
    saver.save(stateOf(clientCommande, 8), DEFAULT_MPD_SETTINGS)
    await repo.syncPending()
    expect(server.documentsOf('A')).toHaveLength(0)

    saver.dispose()
    await repo.syncPending()

    const recovered = server.documentsOf('A')
    expect(recovered.map((d) => d.name)).toEqual(['Doc (récupéré)'])
    expect(contentModel(recovered[0]?.content ?? '')).toEqual(stateOf(clientCommande, 8))
  })
})

describe("dépôt cloud, jamais de mélange entre comptes", () => {
  it('le compte B ne voit aucun document du compte A', async () => {
    const { signIn, cache } = setup()
    const repoA = signIn('A')
    const secret = await repoA.create('Secret de A', stateOf(clientCommande))
    await repoA.list()
    repoA.dispose()

    const repoB = signIn('B')
    await repoB.create('Document de B')
    const listed = await repoB.list()

    expect(listed.ok && listed.value.documents.map((d) => d.name)).toEqual(['Document de B'])
    expect(repoB.cachedList().map((d) => d.name)).toEqual(['Document de B'])
    expect(cache.list().map((d) => d.name)).toEqual(['Document de B'])
    const opened = secret.ok ? await repoB.open(secret.value.id) : null
    expect(opened?.ok).toBe(false)
  })

  it("un envoi différé de A n'est jamais fait après le changement de compte", async () => {
    const { signIn, server } = setup()
    const repoA = signIn('A')
    const created = await repoA.create('Doc A', stateOf(clientCommande))
    if (!created.ok) throw new Error('création impossible')
    const opened = await repoA.open(created.value.id)
    if (!opened.ok) throw new Error('ouverture impossible')
    const saver = repoA.createSaver(opened.value)
    saver.save(stateOf(clientCommande, 99), DEFAULT_MPD_SETTINGS)

    // Changement de compte avant l'échéance de l'envoi, sans même éteindre A.
    signIn('B')
    const before = server.requests.length
    await vi.advanceTimersByTimeAsync(SEND_DELAY_MS * 3)

    expect(server.requests.length).toBe(before)
    expect(contentModel(server.documents.get(created.value.id)?.content ?? '')).toEqual(stateOf(clientCommande))
  })

  it("un dépôt éteint n'agit plus, même par ses méthodes directes", async () => {
    const { signIn, server } = setup()
    const repoA = signIn('A')
    repoA.dispose()
    const before = server.requests.length

    const created = await repoA.create('Fantôme')
    const listed = await repoA.list()

    expect(created.ok || listed.ok).toBe(false)
    expect(server.requests.length).toBe(before)
    expect(repoA.cachedList()).toEqual([])
  })

  it("la boîte d'envoi de A n'est reprise que par A", async () => {
    const { signIn, server, cache } = setup()
    const repoA = signIn('A')
    const created = await repoA.create('Doc A', stateOf(clientCommande))
    if (!created.ok) throw new Error('création impossible')
    const opened = await repoA.open(created.value.id)
    if (!opened.ok) throw new Error('ouverture impossible')
    const saver = repoA.createSaver(opened.value)
    server.setOnline(false)
    saver.save(stateOf(clientCommande, 55), DEFAULT_MPD_SETTINGS)
    await vi.advanceTimersByTimeAsync(SEND_DELAY_MS)

    // Déconnexion de A avec du travail en attente.
    expect(cache.stashPendingToOutbox()).toBe(1)
    repoA.dispose()
    server.setOnline(true)

    const repoB = signIn('B')
    repoB.adoptOutbox(cache.takeOutbox('B'))
    await repoB.syncPending()
    const listedB = await repoB.list()
    expect(listedB.ok && listedB.value.documents).toEqual([])
    expect(server.documentsOf('B')).toEqual([])
    repoB.dispose()

    const repoA2 = signIn('A')
    repoA2.adoptOutbox(cache.takeOutbox('A'))
    await repoA2.syncPending()

    expect(contentModel(server.documents.get(created.value.id)?.content ?? '')).toEqual(stateOf(clientCommande, 55))
    expect(repoA2.pendingCount()).toBe(0)
  })
})

describe('dépôt local, sans compte', () => {
  it('garde le comportement actuel, sans réseau', async () => {
    const store = createDocumentStore(createMemoryStorage(), {
      now: (() => {
        let s = 0
        return () => new Date(Date.UTC(2026, 8, 17, 10, 0, s++))
      })(),
    })
    const repo = createLocalRepository(store)

    const created = await repo.create('Local', stateOf(clientCommande))
    if (!created.ok) throw new Error('création impossible')
    const opened = await repo.open(created.value.id)
    if (!opened.ok) throw new Error('ouverture impossible')
    const saver = repo.createSaver(opened.value)
    const before = store.loadDocument(created.value.id)?.meta.updatedAt

    saver.save(stateOf(clientCommande), DEFAULT_MPD_SETTINGS)
    expect(store.loadDocument(created.value.id)?.meta.updatedAt).toBe(before)

    saver.save(stateOf(clientCommande, 3), DEFAULT_MPD_SETTINGS)
    expect(store.loadDocument(created.value.id)?.state).toEqual(stateOf(clientCommande, 3))
    expect(saver.getStatus().kind).toBe('saved')
    expect(await saver.flush()).toBe(true)
    expect(repo.kind).toBe('local')
    expect((await repo.list()).ok).toBe(true)
  })
})

describe('sauvegarde inerte', () => {
  it('n’enregistre rien et se dit toujours enregistrée', async () => {
    const saver = createInertSaver()
    let seen = 0
    const stop = saver.subscribe(() => {
      seen += 1
    })

    saver.save(stateOf(clientCommande), DEFAULT_MPD_SETTINGS)
    saver.rename('Autre nom')
    saver.retry()

    expect(saver.getStatus()).toEqual({ kind: 'saved' })
    expect(await saver.flush()).toBe(true)
    // Rien ne change, donc rien n'est annoncé à l'indicateur.
    expect(seen).toBe(0)
    stop()
    saver.dispose()
  })
})

describe('dépôt cloud, provenance et suppression', () => {
  /** Ouvre le travail d'un devoir, comme le ferait la page du devoir. */
  async function startWork(setupResult: ReturnType<typeof setup>, repo: DocumentRepository) {
    const work = setupResult.server.startWork(
      'A',
      '01JDEVOIR',
      serializeModel(stateOf(clientCommande), DEFAULT_MPD_SETTINGS, 'Travail'),
    )
    createWorkLinks(setupResult.storage, 'A').set('01JDEVOIR', work.id)
    await repo.list()
    return work.id
  }

  it('la liste porte la provenance jusqu’aux métadonnées affichées', async () => {
    const context = setup()
    const repo = context.signIn('A')
    const travail = await startWork(context, repo)
    const perso = await repo.create('Essai perso', stateOf(clientCommande))

    const listed = await repo.list()

    expect(listed.ok).toBe(true)
    if (!listed.ok) return
    const byId = new Map(listed.value.documents.map((meta) => [meta.id, meta]))
    expect(byId.get(travail)?.origin).toEqual({ kind: 'assignment', assignmentId: '01JDEVOIR' })
    expect(perso.ok && byId.get(perso.value.id)?.origin).toEqual({ kind: 'personal' })
  })

  it('un document de groupe laissé filer par le serveur n’entre pas dans le cache personnel', async () => {
    const context = setup()
    const repo = context.signIn('A')
    const groupe = context.server.createGroupDocument('A', '01JGROUPE')
    context.server.setLeakGroupDocuments(true)

    const listed = await repo.list()

    expect(listed.ok && listed.value.documents.map((d) => d.id)).toEqual([])
    expect(context.cache.get(groupe.id)).toBeNull()
  })

  it('supprimer un travail de devoir oublie le lien de ce devoir', async () => {
    const context = setup()
    const repo = context.signIn('A')
    const travail = await startWork(context, repo)
    const links = createWorkLinks(context.storage, 'A')
    links.set('01JAUTRE', 'doc-autre')

    expect((await repo.remove(travail)).ok).toBe(true)

    expect(links.get('01JDEVOIR')).toBeNull()
    // Le lien d'un autre devoir n'est pas touché.
    expect(links.get('01JAUTRE')).toBe('doc-autre')
    expect(context.server.documents.get(travail)).toBeUndefined()
  })

  it('supprimer un document personnel ne touche aucun lien de devoir', async () => {
    const context = setup()
    const repo = context.signIn('A')
    const travail = await startWork(context, repo)
    const perso = await repo.create('Essai perso', stateOf(clientCommande))
    expect(perso.ok).toBe(true)
    if (!perso.ok) return

    expect((await repo.remove(perso.value.id)).ok).toBe(true)

    expect(createWorkLinks(context.storage, 'A').get('01JDEVOIR')).toBe(travail)
  })

  it('un échec de suppression garde le document, son lien et sa modification en attente', async () => {
    const context = setup()
    const repo = context.signIn('A')
    const travail = await startWork(context, repo)
    const opened = await repo.open(travail)
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    const saver = repo.createSaver(opened.value)
    context.server.setOnline(false)
    saver.save(stateOf(clientCommande, 3), DEFAULT_MPD_SETTINGS)
    await vi.advanceTimersByTimeAsync(SEND_DELAY_MS)

    const removed = await repo.remove(travail)

    expect(removed.ok).toBe(false)
    expect(context.cache.get(travail)?.pending).toBe(true)
    expect(createWorkLinks(context.storage, 'A').get('01JDEVOIR')).toBe(travail)

    // Le serveur revient : la modification part comme avant, rien n'a été purgé.
    context.server.setOnline(true)
    saver.retry()
    await vi.advanceTimersByTimeAsync(SEND_DELAY_MS)
    expect(contentModel(context.server.documents.get(travail)?.content ?? '')).toEqual(
      stateOf(clientCommande, 3),
    )
    saver.dispose()
  })

  it('après une suppression, rien n’est renvoyé ni recréé sous « (récupéré) »', async () => {
    const context = setup()
    const repo = context.signIn('A')
    const created = await repo.create('Doc', stateOf(clientCommande))
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const opened = await repo.open(created.value.id)
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    const saver = repo.createSaver(opened.value)
    context.server.setOnline(false)
    saver.save(stateOf(clientCommande, 5), DEFAULT_MPD_SETTINGS)
    await vi.advanceTimersByTimeAsync(SEND_DELAY_MS)
    context.server.setOnline(true)

    expect((await repo.remove(created.value.id)).ok).toBe(true)

    // Ni l'envoi différé, ni la fermeture, ni une frappe tardive ne le recréent.
    saver.save(stateOf(clientCommande, 6), DEFAULT_MPD_SETTINGS)
    await vi.advanceTimersByTimeAsync(MAX_WAIT_MS)
    await repo.syncPending()
    saver.dispose()
    await repo.syncPending()

    expect(context.server.documentsOf('A')).toEqual([])
    expect(context.cache.get(created.value.id)).toBeNull()
    expect(repo.pendingCount()).toBe(0)
  })

  it('un éditeur ouvert sur le document supprimé passe en erreur et n’enregistre plus rien', async () => {
    const context = setup()
    const repo = context.signIn('A')
    const created = await repo.create('Doc', stateOf(clientCommande))
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const opened = await repo.open(created.value.id)
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    const saver = repo.createSaver(opened.value)

    expect((await repo.remove(created.value.id)).ok).toBe(true)

    const status = saver.getStatus()
    expect(status.kind).toBe('error')
    expect(status.kind === 'error' && status.message).toContain("vient d'être supprimé")
    // Aucune promesse de retour.
    expect(status.kind === 'error' && status.message).not.toContain('récupér')

    saver.save(stateOf(clientCommande, 9), DEFAULT_MPD_SETTINGS)
    await vi.advanceTimersByTimeAsync(MAX_WAIT_MS)
    expect(await saver.flush()).toBe(true)
    expect(context.server.documentsOf('A')).toEqual([])
    saver.dispose()
  })

  it('une suppression déjà faite ailleurs nettoie le lien de la même façon', async () => {
    const context = setup()
    const repo = context.signIn('A')
    const travail = await startWork(context, repo)
    // Le serveur l'a déjà perdu : le DELETE répond 404.
    context.server.documents.delete(travail)

    expect((await repo.remove(travail)).ok).toBe(true)

    expect(createWorkLinks(context.storage, 'A').get('01JDEVOIR')).toBeNull()
    expect(context.cache.get(travail)).toBeNull()
  })
})
