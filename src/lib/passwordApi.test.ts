import { describe, expect, it } from 'vitest'
import type { ApiClient, ApiResult, HttpMethod } from './apiClient'
import { apiError } from './apiClient'
import { requestPasswordReset, resetPassword } from './passwordApi'

function fakeClient(result: ApiResult) {
  const sent: { method: HttpMethod; path: string; body: unknown }[] = []
  const client: ApiClient = {
    isConfigured: true,
    request: async (method, path, body) => {
      sent.push({ method, path, body })
      return result
    },
    requestBlob: async () => ({ ok: false, error: apiError('unexpected', null, 'Binaire non simulé.') }),
  }
  return { client, sent }
}

const GENERIC = 'Si un compte existe pour cette adresse, un lien de réinitialisation vient de partir.'

describe('demander un lien', () => {
  it('envoie l adresse à la route publique', async () => {
    const { client, sent } = fakeClient({ ok: true, status: 200, data: { message: GENERIC }, body: null })

    const outcome = await requestPasswordReset(client, 'ada@etu.fr')

    expect(sent).toEqual([
      { method: 'POST', path: '/auth/password/forgot', body: { email: 'ada@etu.fr' } },
    ])
    expect(outcome).toEqual({ ok: true, value: GENERIC })
  })

  it('fait remonter le refus pour trop de demandes', async () => {
    const error = apiError('rate_limited', 429, 'Trop de tentatives. Réessayez dans 60 secondes.')
    const { client } = fakeClient({ ok: false, error })

    expect(await requestPasswordReset(client, 'ada@etu.fr')).toEqual({ ok: false, error })
  })
})

describe('poser le nouveau mot de passe', () => {
  it('envoie le jeton, l adresse et le mot de passe, et rien d autre', async () => {
    const { client, sent } = fakeClient({
      ok: true,
      status: 200,
      data: { message: 'Votre mot de passe a été réinitialisé.' },
      body: null,
    })

    const outcome = await resetPassword(client, {
      token: 'abc',
      email: 'ada@etu.fr',
      password: 'NouveauSecret1!',
    })

    // La confirmation est une courtoisie de l application : elle ne part
    // jamais sur le réseau.
    expect(sent).toEqual([
      {
        method: 'POST',
        path: '/auth/password/reset',
        body: { token: 'abc', email: 'ada@etu.fr', password: 'NouveauSecret1!' },
      },
    ])
    expect(outcome).toEqual({ ok: true, value: 'Votre mot de passe a été réinitialisé.' })
  })

  it('fait remonter le refus d un lien périmé, tel quel', async () => {
    const error = {
      ...apiError('validation', 422, 'Vérifiez les informations saisies.'),
      fieldErrors: { token: ['Ce lien de réinitialisation est invalide.'] },
    }
    const { client } = fakeClient({ ok: false, error })

    expect(await resetPassword(client, { token: 'faux', email: 'a@b.fr', password: 'x' })).toEqual({
      ok: false,
      error,
    })
  })

  it('refuse une réussite au statut inattendu', async () => {
    const { client } = fakeClient({ ok: true, status: 204, data: undefined, body: null })

    const outcome = await resetPassword(client, { token: 't', email: 'a@b.fr', password: 'x' })

    expect(outcome.ok).toBe(false)
  })
})
