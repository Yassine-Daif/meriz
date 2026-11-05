import type { ApiClient, Outcome } from './apiClient'
import { unexpectedResponse } from './apiClient'
export type ResourceKind = 'assignment' | 'lesson'
export interface TeachingResource { id: string; kind: ResourceKind; title: string; version: number; sourceId: string; publications: { classroomId: string; version: number }[] }
export function parseTeachingResource(raw: unknown): TeachingResource | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const v = raw as Record<string, unknown>
  if (typeof v.id !== 'string' || !v.id || (v.kind !== 'assignment' && v.kind !== 'lesson') || typeof v.title !== 'string' || typeof v.version !== 'number' || !Number.isInteger(v.version) || v.version < 1 || typeof v.source_id !== 'string' || !Array.isArray(v.publications)) return null
  const publications: TeachingResource['publications'] = []
  for (const item of v.publications) {
    if (!item || typeof item !== 'object' || typeof item.classroom_id !== 'string' || typeof item.version !== 'number') return null
    publications.push({ classroomId: item.classroom_id, version: item.version })
  }
  return { id: v.id, title: v.title, kind: v.kind, version: v.version, sourceId: v.source_id, publications }
}
export async function listTeachingResources(client: ApiClient): Promise<Outcome<TeachingResource[]>> {
  const result = await client.request('GET', '/teaching-resources')
  if (!result.ok) return result
  if (!Array.isArray(result.data)) return { ok: false, error: unexpectedResponse(result.status) }
  const resources = result.data.map(parseTeachingResource)
  return resources.every((r): r is TeachingResource => r !== null) ? { ok: true, value: resources } : { ok: false, error: unexpectedResponse(result.status) }
}
export async function captureTeachingResource(client: ApiClient, kind: ResourceKind, sourceId: string, existingId?: string): Promise<Outcome<TeachingResource>> {
  const result = await client.request('POST', existingId ? '/teaching-resources/' + encodeURIComponent(existingId) + '/refresh' : '/teaching-resources', { source_kind: kind, source_id: sourceId })
  if (!result.ok) return result
  const resource = parseTeachingResource(result.data)
  return resource ? { ok: true, value: resource } : { ok: false, error: unexpectedResponse(result.status) }
}
