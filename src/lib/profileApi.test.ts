import { describe, expect, it } from 'vitest'
import type { ApiClient, ApiResult, HttpMethod } from './apiClient'
import { publicPreview, updateProfile } from './profileApi'

function fakeClient(result: ApiResult) {
  const sent: { method: HttpMethod; path: string; body: unknown }[] = []
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
  name: 'Lovelace',
  first_name: 'Ada',
  email: 'ada@etu.univ.fr',
  role: 'student',
  is_academic: true,
  bio: 'Merise avant tout',
  bio_shared: true,
  contact: 'ada@contact.fr',
  contact_shared: false,
}

describe('profil, enregistrement', () => {
  it('envoie les champs en snake_case, et seulement ceux fournis', async () => {
    const { client, sent } = fakeClient({ ok: true, status: 200, data: serverUser, body: null })

    const outcome = await updateProfile(client, {
      firstName: 'Ada',
      bio: null,
      bioShared: false,
      contactShared: true,
    })

    expect(sent).toEqual([
      {
        method: 'PATCH',
        path: '/me',
        body: { first_name: 'Ada', bio: null, bio_shared: false, contact_shared: true },
      },
    ])
    expect(outcome.ok && outcome.value.firstName).toBe('Ada')
  })

  it('refuse une réponse mal formée', async () => {
    const { client } = fakeClient({ ok: true, status: 200, data: { ...serverUser, contact_shared: 'non' }, body: null })

    const outcome = await updateProfile(client, { name: 'X' })

    expect(outcome.ok ? null : outcome.error.kind).toBe('unexpected')
  })
})

describe('profil, ce que voient les autres', () => {
  const base = { firstName: 'Ada', name: 'Lovelace', bio: 'Bonjour', contact: 'ada@contact.fr' }

  it('ne montre rien tant que le partage est coupé (réglage par défaut)', () => {
    expect(publicPreview({ ...base, bioShared: false, contactShared: false })).toEqual({
      firstName: 'Ada',
      name: 'Lovelace',
      bio: null,
      contact: null,
    })
  })

  it('montre ce qui est partagé et rempli', () => {
    expect(publicPreview({ ...base, bioShared: true, contactShared: true })).toMatchObject({
      bio: 'Bonjour',
      contact: 'ada@contact.fr',
    })
  })

  it('ne montre pas un champ partagé mais vide', () => {
    expect(publicPreview({ ...base, bio: '   ', bioShared: true, contactShared: false }).bio).toBeNull()
  })
})
