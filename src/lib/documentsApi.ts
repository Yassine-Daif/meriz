import type { ApiClient, Outcome } from './apiClient'
import { unexpectedResponse } from './apiClient'

/**
 * Appels des documents du compte connecté. Le serveur cloisonne les
 * documents par utilisateur ; chaque réponse est tout de même vérifiée
 * avant usage. Le contenu circule en chaîne JSON : le fichier Meriz
 * sérialisé, que le serveur garde tel quel.
 */

export interface CloudDocumentMeta {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface CloudDocument extends CloudDocumentMeta {
  content: string
}

/** Taille des pages de la liste (maximum accepté par le serveur). */
const PAGE_SIZE = 100
/** Garde-fou : 20 pages couvrent largement le quota de 1000 documents. */
const MAX_PAGES = 20

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseCloudMeta(raw: unknown): CloudDocumentMeta | null {
  if (
    !isRecord(raw) ||
    typeof raw.id !== 'string' ||
    raw.id === '' ||
    typeof raw.name !== 'string' ||
    typeof raw.created_at !== 'string' ||
    typeof raw.updated_at !== 'string'
  ) {
    return null
  }
  return { id: raw.id, name: raw.name, createdAt: raw.created_at, updatedAt: raw.updated_at }
}

export function parseCloudDocument(raw: unknown): CloudDocument | null {
  const meta = parseCloudMeta(raw)
  if (!meta || !isRecord(raw) || typeof raw.content !== 'string') {
    return null
  }
  return { ...meta, content: raw.content }
}

function documentPath(id: string): string {
  return `/documents/${encodeURIComponent(id)}`
}

/** Toute la liste, page par page. Une page mal formée invalide le tout. */
export async function listAllDocuments(client: ApiClient): Promise<Outcome<CloudDocumentMeta[]>> {
  const documents: CloudDocumentMeta[] = []
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result = await client.request('GET', `/documents?per_page=${PAGE_SIZE}&page=${page}`)
    if (!result.ok) {
      return result
    }
    if (!Array.isArray(result.data)) {
      return { ok: false, error: unexpectedResponse(result.status) }
    }
    for (const raw of result.data) {
      const meta = parseCloudMeta(raw)
      if (!meta) {
        return { ok: false, error: unexpectedResponse(result.status) }
      }
      documents.push(meta)
    }
    const lastPage =
      isRecord(result.body) && isRecord(result.body.meta) && typeof result.body.meta.last_page === 'number'
        ? result.body.meta.last_page
        : page
    if (page >= lastPage || result.data.length === 0) {
      break
    }
  }
  return { ok: true, value: documents }
}

async function documentRequest(
  client: ApiClient,
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: Record<string, string>,
): Promise<Outcome<CloudDocument>> {
  const result = await client.request(method, path, body)
  if (!result.ok) {
    return result
  }
  const document = parseCloudDocument(result.data)
  return document ? { ok: true, value: document } : { ok: false, error: unexpectedResponse(result.status) }
}

export function getCloudDocument(client: ApiClient, id: string): Promise<Outcome<CloudDocument>> {
  return documentRequest(client, 'GET', documentPath(id))
}

export function createCloudDocument(
  client: ApiClient,
  data: { name: string; content: string },
): Promise<Outcome<CloudDocument>> {
  return documentRequest(client, 'POST', '/documents', { name: data.name, content: data.content })
}

export function updateCloudDocument(
  client: ApiClient,
  id: string,
  patch: { name?: string; content?: string },
): Promise<Outcome<CloudDocument>> {
  const body: Record<string, string> = {}
  if (patch.name !== undefined) body.name = patch.name
  if (patch.content !== undefined) body.content = patch.content
  return documentRequest(client, 'PATCH', documentPath(id), body)
}

export async function deleteCloudDocument(client: ApiClient, id: string): Promise<Outcome<void>> {
  const result = await client.request('DELETE', documentPath(id))
  return result.ok ? { ok: true, value: undefined } : result
}
