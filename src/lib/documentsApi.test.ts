import { describe, expect, it } from 'vitest'
import type { ApiClient, ApiResult, HttpMethod } from './apiClient'
import { apiError } from './apiClient'
import {
  createCloudDocument,
  deleteCloudDocument,
  getCloudDocument,
  listAllDocuments,
  updateCloudDocument,
} from './documentsApi'

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
      return responses.shift() ?? { ok: true, status: 200, data: [], body: { data: [] } }
    },
    // Le binaire n'est pas simulé ici : aucun test ne lit d'image.
    requestBlob: async () => ({ ok: false, error: apiError('unexpected', null, 'Binaire non simulé.') }),
    }
  return { client, sent }
}

const row = (id: string) => ({ id, name: `Doc ${id}`, created_at: '2026-09-17T10:00:00Z', updated_at: '2026-09-17T11:00:00Z' })
const page = (items: unknown[], lastPage: number): ApiResult => ({
  ok: true,
  status: 200,
  data: items,
  body: { data: items, meta: { last_page: lastPage } },
})

describe('documentsApi, liste', () => {
  it('lit toutes les pages, 100 par 100', async () => {
    const { client, sent } = scriptedClient([page([row('a'), row('b')], 2), page([row('c')], 2)])

    const result = await listAllDocuments(client)

    expect(result.ok && result.value.map((d) => d.id)).toEqual(['a', 'b', 'c'])
    expect(sent.map((s) => s.path)).toEqual([
      '/documents?per_page=100&page=1',
      '/documents?per_page=100&page=2',
    ])
  })

  it('refuse une liste dont une ligne est mal formée', async () => {
    const { client } = scriptedClient([page([row('a'), { id: 7 }], 1)])

    const result = await listAllDocuments(client)

    expect(result.ok ? null : result.error.kind).toBe('unexpected')
  })

  it("transmet l'erreur du client", async () => {
    const { client } = scriptedClient([{ ok: false, error: { kind: 'network', status: null, message: 'x', fieldErrors: {} } }])

    const result = await listAllDocuments(client)

    expect(result.ok ? null : result.error.kind).toBe('network')
  })
})

describe('documentsApi, un document', () => {
  const full = { ...row('d1'), content: '{"format":"meriz-mcd"}' }

  it('lit, crée, modifie et supprime sur les bons chemins', async () => {
    const { client, sent } = scriptedClient([
      { ok: true, status: 200, data: full, body: null },
      { ok: true, status: 201, data: full, body: null },
      { ok: true, status: 200, data: full, body: null },
      { ok: true, status: 204, data: undefined, body: undefined },
    ])

    const got = await getCloudDocument(client, 'd/1')
    await createCloudDocument(client, { name: 'N', content: '{}' })
    await updateCloudDocument(client, 'd1', { content: '{"v":2}' })
    const removed = await deleteCloudDocument(client, 'd1')

    expect(got.ok && got.value).toEqual({
      id: 'd1',
      name: 'Doc d1',
      content: '{"format":"meriz-mcd"}',
      createdAt: '2026-09-17T10:00:00Z',
      updatedAt: '2026-09-17T11:00:00Z',
    })
    expect(removed).toEqual({ ok: true, value: undefined })
    expect(sent).toEqual([
      { method: 'GET', path: '/documents/d%2F1', body: undefined },
      { method: 'POST', path: '/documents', body: { name: 'N', content: '{}' } },
      { method: 'PATCH', path: '/documents/d1', body: { content: '{"v":2}' } },
      { method: 'DELETE', path: '/documents/d1', body: undefined },
    ])
  })

  it('refuse un document sans contenu texte', async () => {
    const { client } = scriptedClient([{ ok: true, status: 200, data: { ...row('d1'), content: { objet: true } }, body: null }])

    const result = await getCloudDocument(client, 'd1')

    expect(result.ok ? null : result.error.kind).toBe('unexpected')
  })
})
