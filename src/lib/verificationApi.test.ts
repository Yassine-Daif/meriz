import { describe, expect, it } from 'vitest'
import type { ApiClient, ApiResult, HttpMethod } from './apiClient'
import { apiError } from './apiClient'
import { resendVerification } from './verificationApi'

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

describe('renvoi du lien de vérification', () => {
  it('appelle la route de renvoi, sans corps', async () => {
    const { client, sent } = fakeClient({
      ok: true,
      status: 202,
      data: { message: 'Lien de vérification envoyé.' },
      body: null,
    })

    await resendVerification(client)

    expect(sent).toEqual([
      { method: 'POST', path: '/auth/email/verification-notification', body: undefined },
    ])
  })

  // Les deux réussites se distinguent par le statut, pas par le texte.
  it('lit le 202 comme un envoi', async () => {
    const { client } = fakeClient({ ok: true, status: 202, data: { message: 'Lien parti.' }, body: null })

    const outcome = await resendVerification(client)

    expect(outcome).toEqual({ ok: true, value: { state: 'sent', message: 'Lien parti.' } })
  })

  it('lit le 200 comme une adresse déjà confirmée', async () => {
    const { client } = fakeClient({
      ok: true,
      status: 200,
      data: { message: 'Cet email est déjà vérifié.' },
      body: null,
    })

    const outcome = await resendVerification(client)

    expect(outcome).toEqual({
      ok: true,
      value: { state: 'already', message: 'Cet email est déjà vérifié.' },
    })
  })

  it('se rabat sur son propre message quand le serveur n en donne pas', async () => {
    const { client } = fakeClient({ ok: true, status: 202, data: undefined, body: null })

    const outcome = await resendVerification(client)

    expect(outcome).toEqual({
      ok: true,
      value: { state: 'sent', message: 'Lien de vérification envoyé.' },
    })
  })

  it('refuse un statut de réussite inattendu', async () => {
    const { client } = fakeClient({ ok: true, status: 204, data: undefined, body: null })

    const outcome = await resendVerification(client)

    expect(outcome.ok).toBe(false)
  })

  // Le quota est tenu par le serveur : on fait remonter son erreur telle quelle.
  it('fait remonter le refus pour trop de demandes', async () => {
    const error = { ...apiError('rate_limited', 429, 'Trop de tentatives. Réessayez dans 60 secondes.'), retryAfter: 60 }
    const { client } = fakeClient({ ok: false, error })

    const outcome = await resendVerification(client)

    expect(outcome).toEqual({ ok: false, error })
  })
})
