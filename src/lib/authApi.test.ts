import { describe, expect, it } from 'vitest'
import type { ApiClient, ApiResult, HttpMethod } from './apiClient'
import { apiError } from './apiClient'
import { displayName, fetchCurrentUser, login, logout, parseApiUser, register } from './authApi'

interface Sent {
  method: HttpMethod
  path: string
  body: unknown
}

/** Client simulé : enregistre l'appel et renvoie le résultat fourni. */
function fakeClient(result: ApiResult) {
  const sent: Sent[] = []
  const client: ApiClient = {
    isConfigured: true,
    request: async (method, path, body) => {
      sent.push({ method, path, body })
      return result
    },
  }
  return { client, sent }
}

const serverUser = {
  id: 3,
  name: 'Ada',
  email: 'ada@etu.univ.fr',
  role: 'student',
  is_academic: true,
  email_verified_at: null,
  created_at: '2026-09-17T10:00:00+00:00',
}

describe('authApi, envois', () => {
  it("inscrit sans rôle, avec le nom de l'appareil", async () => {
    const { client, sent } = fakeClient({ ok: true, status: 201, data: { user: serverUser, token: '1|abc', token_type: 'Bearer' }, body: null })

    await register(client, { firstName: 'Ada', name: 'Lovelace', email: 'ada@etu.univ.fr', password: 'secret123' })

    expect(sent).toEqual([
      {
        method: 'POST',
        path: '/auth/register',
        body: { name: 'Lovelace', first_name: 'Ada', email: 'ada@etu.univ.fr', password: 'secret123', device_name: 'Meriz web' },
      },
    ])
  })

  it('connecte par email et mot de passe', async () => {
    const { client, sent } = fakeClient({ ok: true, status: 200, data: { user: serverUser, token: '1|abc' }, body: null })

    await login(client, { email: 'ada@etu.univ.fr', password: 'secret123' })

    expect(sent[0]).toEqual({
      method: 'POST',
      path: '/auth/login',
      body: { email: 'ada@etu.univ.fr', password: 'secret123', device_name: 'Meriz web' },
    })
  })

  it('déconnecte en révoquant le jeton (204)', async () => {
    const { client, sent } = fakeClient({ ok: true, status: 204, data: undefined, body: null })

    expect(await logout(client)).toEqual({ ok: true, value: undefined })
    expect(sent[0]).toMatchObject({ method: 'POST', path: '/auth/logout' })
  })
})

describe('authApi, réponses', () => {
  it("renvoie l'utilisateur et le jeton vérifiés", async () => {
    const { client } = fakeClient({ ok: true, status: 200, data: { user: serverUser, token: '1|abc' }, body: null })

    expect(await login(client, { email: 'a@b.fr', password: 'x' })).toEqual({
      ok: true,
      value: {
        token: '1|abc',
        user: {
          id: 3,
          name: 'Ada',
          firstName: null,
          email: 'ada@etu.univ.fr',
          role: 'student',
          isAcademic: true,
          bio: null,
          bioShared: false,
          contact: null,
          contactShared: false,
        },
      },
    })
  })

  it('refuse une réponse sans jeton ou au profil incomplet', async () => {
    const noToken = fakeClient({ ok: true, status: 200, data: { user: serverUser }, body: null })
    const badRole = fakeClient({ ok: true, status: 200, data: { user: { ...serverUser, role: 'admin' }, token: 't' }, body: null })

    const first = await login(noToken.client, { email: 'a@b.fr', password: 'x' })
    const second = await login(badRole.client, { email: 'a@b.fr', password: 'x' })

    expect(first.ok ? null : first.error.kind).toBe('unexpected')
    expect(second.ok ? null : second.error.kind).toBe('unexpected')
  })

  it('transmet les erreurs du client telles quelles', async () => {
    const error = apiError('network', null, 'Serveur injoignable.')
    const { client } = fakeClient({ ok: false, error })

    expect(await fetchCurrentUser(client)).toEqual({ ok: false, error })
  })

  it('lit le profil courant', async () => {
    const { client, sent } = fakeClient({ ok: true, status: 200, data: serverUser, body: null })

    const outcome = await fetchCurrentUser(client)

    expect(sent[0]).toEqual({ method: 'GET', path: '/me', body: undefined })
    expect(outcome.ok && outcome.value.name).toBe('Ada')
  })
})

describe('authApi, profil complet', () => {
  it('lit prénom, présentation et contact avec leurs partages', () => {
    const user = parseApiUser({
      ...serverUser,
      first_name: 'Ada',
      bio: 'Passionnée de Merise',
      bio_shared: true,
      contact: 'ada@contact.fr',
      contact_shared: false,
    })

    expect(user).toMatchObject({
      firstName: 'Ada',
      bio: 'Passionnée de Merise',
      bioShared: true,
      contact: 'ada@contact.fr',
      contactShared: false,
    })
  })

  it("tolère un ancien compte sans prénom ni champs de profil", () => {
    expect(parseApiUser(serverUser)).toMatchObject({ firstName: null, bio: null, bioShared: false })
  })

  it('refuse un champ de profil mal typé', () => {
    expect(parseApiUser({ ...serverUser, bio_shared: 'oui' })).toBeNull()
    expect(parseApiUser({ ...serverUser, first_name: 42 })).toBeNull()
  })

  it('compose « Prénom Nom », ou le nom seul sans prénom', () => {
    expect(displayName({ firstName: 'Ada', name: 'Lovelace' })).toBe('Ada Lovelace')
    expect(displayName({ firstName: null, name: 'Lovelace' })).toBe('Lovelace')
    expect(displayName({ firstName: '  ', name: 'Lovelace' })).toBe('Lovelace')
  })
})
