import { describe, expect, it } from 'vitest'
import type { ApiClient, ApiResult, HttpMethod } from './apiClient'
import { apiError } from './apiClient'
import {
  createGroup,
  createGroupDocument,
  deleteGroup,
  getGroup,
  joinGroup,
  leaveGroup,
  listGroupDocuments,
  listGroups,
  parseGroupDetail,
  parseGroupDocument,
  regenerateGroupCode,
  removeGroupMember,
  renameGroup,
} from './groupsApi'

interface Sent {
  method: HttpMethod
  path: string
  body: unknown
}

function scriptedClient(responses: ApiResult[]) {
  const sent: Sent[] = []
  const client: ApiClient = {
    isConfigured: true,
    request: async (method, path, body) => {
      sent.push({ method, path, body })
      return responses.shift() ?? { ok: true, status: 204, data: undefined, body: undefined }
    },
    requestBlob: async () => ({ ok: false, error: apiError('unexpected', null, 'Binaire non simulé.') }),
  }
  return { client, sent }
}

const creator = { id: 7, name: 'Roy', first_name: 'Camille', bio: null, contact: null }
const other = { id: 9, name: 'Martin', first_name: 'Claire', bio: 'Bonjour', contact: null }

const documentView = {
  id: '01J8ZDOC',
  name: 'Travail du groupe',
  assignment_id: null,
  group_id: '01J8ZGROUPE',
  last_observed_at: null,
  created_at: '2026-10-06T09:00:00+00:00',
  updated_at: '2026-10-06T09:30:00+00:00',
}

const creatorView = {
  id: '01J8ZGROUPE',
  name: 'Projet Merise',
  my_role: 'admin',
  join_code: 'ABCD2345',
  members_count: 2,
  documents_count: 1,
  creator,
  members: [
    { ...creator, is_admin: true, joined_at: '2026-10-06T08:00:00+00:00' },
    { ...other, is_admin: false, joined_at: '2026-10-06T08:30:00+00:00' },
  ],
  documents: [documentView],
  created_at: '2026-10-06T08:00:00+00:00',
}

/** Vue d'un membre : ni code, ni documents listés par cette route. */
const joinedView = {
  id: '01J8ZGROUPE',
  name: 'Projet Merise',
  my_role: 'member',
  members_count: 2,
  documents_count: 1,
  creator,
  members: [
    { ...creator, is_admin: true, joined_at: '2026-10-06T08:00:00+00:00' },
    { ...other, is_admin: false, joined_at: '2026-10-06T08:30:00+00:00' },
  ],
  created_at: '2026-10-06T08:00:00+00:00',
}

const ok = (data: unknown, status = 200): ApiResult => ({ ok: true, status, data, body: { data } })

describe('groupes, lecture des réponses', () => {
  it('vue du créateur : code, compteurs et membres', () => {
    const group = parseGroupDetail(creatorView)

    expect(group).toMatchObject({
      id: '01J8ZGROUPE',
      name: 'Projet Merise',
      myRole: 'admin',
      joinCode: 'ABCD2345',
      membersCount: 2,
      documentsCount: 1,
    })
    expect(group?.creator).toMatchObject({ id: 7, firstName: 'Camille' })
    expect(group?.members[0]).toMatchObject({ id: 7, isAdmin: true, joinedAt: '2026-10-06T08:00:00+00:00' })
    expect(group?.members[1]).toMatchObject({ id: 9, isAdmin: false })
    expect(group?.documents).toHaveLength(1)
    expect(group?.documents?.[0]).toMatchObject({ id: '01J8ZDOC', groupId: '01J8ZGROUPE', content: null })
  })

  it('vue d’un membre : pas de code', () => {
    const group = parseGroupDetail(joinedView)

    expect(group?.myRole).toBe('member')
    expect(group?.joinCode).toBeNull()
  })

  it('accepte une réponse d’adhésion sans documents', () => {
    const group = parseGroupDetail(joinedView)

    // Absents de la réponse, donc inconnus : le panneau les chargera.
    expect(group?.documents).toBeNull()
    expect(group?.members).toHaveLength(2)
  })

  it('distingue une liste de documents vide d’une liste absente', () => {
    expect(parseGroupDetail({ ...joinedView, documents: [] })?.documents).toEqual([])
  })

  it('ne laisse sortir aucun email', () => {
    const group = parseGroupDetail({
      ...creatorView,
      creator: { ...creator, email: 'camille@essai.test' },
    })

    expect(JSON.stringify(group)).not.toContain('camille@essai.test')
    expect(JSON.stringify(group)).not.toContain('email')
  })

  it('pose les couleurs de pastille par défaut quand elles manquent', () => {
    const group = parseGroupDetail(creatorView)

    expect(group?.members[0]?.avatarBg).toMatch(/^#[0-9a-f]{6}$/i)
    expect(group?.members[0]?.avatarFg).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('refuse une réponse mal formée', () => {
    expect(parseGroupDetail({ ...creatorView, my_role: 'owner' })).toBeNull()
    expect(parseGroupDetail({ ...creatorView, members_count: '2' })).toBeNull()
    expect(parseGroupDetail({ ...creatorView, documents_count: '1' })).toBeNull()
    expect(parseGroupDetail({ ...creatorView, members: [{ id: 'x' }] })).toBeNull()
    expect(parseGroupDetail({ ...creatorView, members: 'deux' })).toBeNull()
    expect(parseGroupDetail({ ...creatorView, documents: [{ ...documentView, group_id: '' }] })).toBeNull()
    expect(parseGroupDocument({ ...documentView, group_id: undefined })).toBeNull()
    expect(parseGroupDocument({ ...documentView, content: 42 })).toBeNull()
  })

  it('lit le contenu quand la route le donne', () => {
    expect(parseGroupDocument({ ...documentView, content: '{"format":"meriz-mcd"}' })).toMatchObject({
      content: '{"format":"meriz-mcd"}',
    })
  })
})

describe('groupes, ce qui part sur le fil', () => {
  it('liste, détail et adhésion', async () => {
    const { client, sent } = scriptedClient([ok([joinedView]), ok(creatorView), ok(joinedView)])

    const liste = await listGroups(client)
    const detail = await getGroup(client, '01J8ZGROUPE')
    const rejoint = await joinGroup(client, ' abcd-2345 ')

    expect(liste.ok && liste.value).toHaveLength(1)
    expect(detail.ok).toBe(true)
    expect(rejoint.ok).toBe(true)
    expect(sent[0]).toMatchObject({ method: 'GET', path: '/groups' })
    expect(sent[1]).toMatchObject({ method: 'GET', path: '/groups/01J8ZGROUPE' })
    // Le code part normalisé : majuscules, sans espaces ni tirets.
    expect(sent[2]).toMatchObject({ method: 'POST', path: '/groups/join', body: { code: 'ABCD2345' } })
  })

  it('création, renommage, nouveau code et départs', async () => {
    const { client, sent } = scriptedClient([
      ok(creatorView, 201),
      ok(creatorView),
      ok(creatorView),
      { ok: true, status: 204, data: undefined, body: undefined },
      { ok: true, status: 204, data: undefined, body: undefined },
      { ok: true, status: 204, data: undefined, body: undefined },
    ])

    await createGroup(client, 'Projet Merise')
    await renameGroup(client, '01J8ZGROUPE', 'Projet Merise 2')
    await regenerateGroupCode(client, '01J8ZGROUPE')
    await removeGroupMember(client, '01J8ZGROUPE', 9)
    await leaveGroup(client, '01J8ZGROUPE')
    await deleteGroup(client, '01J8ZGROUPE')

    expect(sent[0]).toMatchObject({ method: 'POST', path: '/groups', body: { name: 'Projet Merise' } })
    expect(sent[1]).toMatchObject({ method: 'PATCH', path: '/groups/01J8ZGROUPE', body: { name: 'Projet Merise 2' } })
    expect(sent[2]).toMatchObject({ method: 'POST', path: '/groups/01J8ZGROUPE/code', body: undefined })
    expect(sent[3]).toMatchObject({ method: 'DELETE', path: '/groups/01J8ZGROUPE/members/9' })
    expect(sent[4]).toMatchObject({ method: 'DELETE', path: '/groups/01J8ZGROUPE/membership' })
    expect(sent[5]).toMatchObject({ method: 'DELETE', path: '/groups/01J8ZGROUPE' })
  })

  it('documents du groupe : liste et création', async () => {
    const { client, sent } = scriptedClient([
      ok([documentView]),
      ok({ ...documentView, content: '{"format":"meriz-mcd"}' }, 201),
    ])

    const liste = await listGroupDocuments(client, '01J8ZGROUPE')
    const cree = await createGroupDocument(client, '01J8ZGROUPE', {
      name: 'Travail du groupe',
      content: '{"format":"meriz-mcd"}',
    })

    expect(liste.ok && liste.value[0]).toMatchObject({ id: '01J8ZDOC', groupId: '01J8ZGROUPE' })
    expect(cree.ok && cree.value.content).toBe('{"format":"meriz-mcd"}')
    expect(sent[0]).toMatchObject({ method: 'GET', path: '/groups/01J8ZGROUPE/documents' })
    expect(sent[1]).toMatchObject({
      method: 'POST',
      path: '/groups/01J8ZGROUPE/documents',
      body: { name: 'Travail du groupe', content: '{"format":"meriz-mcd"}' },
    })
  })

  it('échappe l’identifiant dans le chemin', async () => {
    const { client, sent } = scriptedClient([ok(creatorView)])

    await getGroup(client, 'a/b c')

    expect(sent[0]?.path).toBe('/groups/a%2Fb%20c')
  })
})

describe('groupes, erreurs transmises telles quelles', () => {
  it('garde l’erreur de champ du serveur', async () => {
    const error = apiError('validation', 422, 'Ce groupe est complet.')
    error.fieldErrors.code = ['Ce groupe est complet.']
    const { client } = scriptedClient([{ ok: false, error }])

    const result = await joinGroup(client, 'ABCD2345')

    expect(result.ok).toBe(false)
    expect(!result.ok && result.error.fieldErrors.code).toEqual(['Ce groupe est complet.'])
  })

  it('garde le refus du serveur quand le créateur veut quitter', async () => {
    const message = 'Le créateur ne peut pas quitter son groupe, il peut le supprimer.'
    const { client } = scriptedClient([{ ok: false, error: apiError('forbidden', 403, message) }])

    const result = await leaveGroup(client, '01J8ZGROUPE')

    expect(!result.ok && result.error.message).toBe(message)
  })

  it('garde la limitation de débit de l’adhésion', async () => {
    const { client } = scriptedClient([
      { ok: false, error: apiError('rate_limited', 429, 'Trop de tentatives.') },
    ])

    const result = await joinGroup(client, 'ABCD2345')

    expect(!result.ok && result.error.kind).toBe('rate_limited')
  })

  it('refuse une réponse illisible', async () => {
    const { client } = scriptedClient([ok({ id: '01J8ZGROUPE' })])

    const result = await getGroup(client, '01J8ZGROUPE')

    expect(!result.ok && result.error.kind).toBe('unexpected')
  })
})
