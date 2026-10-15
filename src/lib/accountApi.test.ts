import { describe, expect, it } from 'vitest'
import type { ApiClient, ApiResult, HttpMethod, Outcome } from './apiClient'
import { apiError } from './apiClient'
import { deleteAccount, exportAccountData, exportFileName } from './accountApi'

function fakeClient(result: ApiResult, blob?: Outcome<Blob>) {
  const sent: { method: HttpMethod; path: string; body: unknown }[] = []
  const read: string[] = []
  const client: ApiClient = {
    isConfigured: true,
    request: async (method, path, body) => {
      sent.push({ method, path, body })
      return result
    },
    requestBlob: async (path) => {
      read.push(path)
      return blob ?? { ok: false, error: apiError('unexpected', null, 'Binaire non simulé.') }
    },
  }
  return { client, sent, read }
}

const ok: ApiResult = { ok: true, status: 204, data: undefined, body: null }

describe('export des données', () => {
  it('lit la route d export en binaire, servie par jeton', async () => {
    const fichier = new Blob(['{}'], { type: 'application/json' })
    const { client, read } = fakeClient(ok, { ok: true, value: fichier })

    const outcome = await exportAccountData(client)

    expect(read).toEqual(['/me/export'])
    expect(outcome).toEqual({ ok: true, value: fichier })
  })

  // Une lecture binaire ne rend que le contenu : le nom se refait ici.
  it('date le nom du fichier', () => {
    expect(exportFileName(new Date(2026, 2, 7))).toBe('meriz-donnees-2026-03-07.json')
    expect(exportFileName(new Date(2026, 11, 25))).toBe('meriz-donnees-2026-12-25.json')
  })
})

describe('suppression du compte', () => {
  it('envoie le mot de passe, sans aucun identifiant', async () => {
    const { client, sent } = fakeClient(ok)

    const outcome = await deleteAccount(client, 'secret')

    expect(sent).toEqual([{ method: 'DELETE', path: '/me', body: { password: 'secret' } }])
    expect(outcome).toEqual({ ok: true, value: undefined })
  })

  it('fait remonter le refus du serveur, champ par champ', async () => {
    const error = {
      ...apiError('validation', 422, 'Vérifiez les informations saisies.'),
      fieldErrors: { password: ['Mot de passe incorrect.'] },
    }
    const { client } = fakeClient({ ok: false, error })

    const outcome = await deleteAccount(client, 'faux')

    expect(outcome).toEqual({ ok: false, error })
  })
})
