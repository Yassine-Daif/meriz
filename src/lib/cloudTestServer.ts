import type { ApiClient, ApiResult } from './apiClient'
import { apiError } from './apiClient'

/**
 * Faux serveur de documents, en mémoire, pour les tests uniquement.
 * Il reproduit le contrat de Meriz API : documents cloisonnés par
 * compte (un document d'un autre compte donne 404), liste paginée sans
 * contenu, jeton obligatoire. Aucun code de l'application ne l'importe.
 */

interface StoredDocument {
  id: string
  ownerId: string
  name: string
  content: string
  createdAt: string
  updatedAt: string
}

export interface RecordedRequest {
  method: string
  path: string
  token: string | null
  body: unknown
}

export function createCloudTestServer() {
  const documents = new Map<string, StoredDocument>()
  const tokens = new Map<string, string>()
  const requests: RecordedRequest[] = []
  let online = true
  let sequence = 0
  let clock = 0
  const timestamp = () => new Date(Date.UTC(2026, 8, 17, 10, 0, 0) + ++clock * 1000).toISOString()

  const publicDocument = (document: StoredDocument, withContent: boolean) => ({
    id: document.id,
    name: document.name,
    ...(withContent ? { content: document.content } : {}),
    created_at: document.createdAt,
    updated_at: document.updatedAt,
  })

  const success = (status: number, data: unknown, body: unknown = { data }): ApiResult => ({
    ok: true,
    status,
    data,
    body,
  })
  const notFound: ApiResult = { ok: false, error: apiError('not_found', 404, 'Document introuvable.') }

  const handle = (userId: string, method: string, path: string, body: unknown): ApiResult => {
    const input = (body ?? {}) as { name?: string; content?: string }
    const [pathname = '', query = ''] = path.split('?')
    if (pathname === '/documents' && method === 'GET') {
      const params = new URLSearchParams(query)
      const perPage = Number(params.get('per_page') ?? 50)
      const page = Number(params.get('page') ?? 1)
      const own = [...documents.values()]
        .filter((document) => document.ownerId === userId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      const data = own.slice((page - 1) * perPage, page * perPage).map((d) => publicDocument(d, false))
      const lastPage = Math.max(1, Math.ceil(own.length / perPage))
      return success(200, data, { data, meta: { total: own.length, last_page: lastPage } })
    }
    if (pathname === '/documents' && method === 'POST') {
      const now = timestamp()
      const document: StoredDocument = {
        id: `doc-${++sequence}`,
        ownerId: userId,
        name: input.name ?? '',
        content: input.content ?? '',
        createdAt: now,
        updatedAt: now,
      }
      documents.set(document.id, document)
      return success(201, publicDocument(document, true))
    }
    const match = /^\/documents\/([^/]+)$/.exec(pathname)
    const id = match ? decodeURIComponent(match[1] ?? '') : ''
    const document = documents.get(id)
    // Cloisonnement : le document d'un autre compte est « introuvable ».
    if (!document || document.ownerId !== userId) {
      return notFound
    }
    if (method === 'GET') {
      return success(200, publicDocument(document, true))
    }
    if (method === 'PATCH') {
      if (input.name !== undefined) document.name = input.name
      if (input.content !== undefined) document.content = input.content
      document.updatedAt = timestamp()
      return success(200, publicDocument(document, true))
    }
    if (method === 'DELETE') {
      documents.delete(id)
      return success(204, undefined, undefined)
    }
    return { ok: false, error: apiError('unexpected', 405, 'Méthode inattendue.') }
  }

  return {
    documents,
    requests,
    /** Jeton valide pour un compte. */
    tokenFor: (userId: string) => {
      const token = `jeton-${userId}`
      tokens.set(token, userId)
      return token
    },
    setOnline: (value: boolean) => {
      online = value
    },
    /** Client qui lit son jeton au moment de chaque requête. */
    clientFor: (getToken: () => string | null): ApiClient => ({
      isConfigured: true,
      request: async (method, path, body) => {
        const token = getToken()
        requests.push({ method, path, token, body })
        if (!online) {
          return { ok: false, error: apiError('network', null, 'Serveur injoignable.') }
        }
        const userId = token ? tokens.get(token) : undefined
        if (!userId) {
          return { ok: false, error: apiError('unauthorized', 401, 'Session expirée.') }
        }
        return handle(userId, method, path, body)
      },
    }),
    documentsOf: (userId: string) => [...documents.values()].filter((d) => d.ownerId === userId),
  }
}
