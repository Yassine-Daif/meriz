import { periodKey } from './collectionPeriod'
import type { ApiClient, Outcome } from './apiClient'
import { unexpectedResponse } from './apiClient'
export type CollectionKind = 'classrooms' | 'groups'
export interface WorkspaceCollection {
  id: string
  name: string
  kind: CollectionKind
  yearStart: number | null
  archived: boolean
  periodKind?: 'academic' | 'calendar'
  itemIds: string[]
}
export type CollectionDraft = Omit<WorkspaceCollection, 'id'>
export function parseCollection(raw: unknown): WorkspaceCollection | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const v = raw as Record<string, unknown>
  if (
    typeof v.id !== 'string' ||
    !v.id ||
    typeof v.name !== 'string' ||
    (v.kind !== 'classrooms' && v.kind !== 'groups') ||
    (v.year_start !== null &&
      (!Number.isInteger(v.year_start) || typeof v.year_start !== 'number')) ||
    (v.period_kind !== undefined &&
      v.period_kind !== 'academic' &&
      v.period_kind !== 'calendar') ||
    typeof v.archived !== 'boolean' ||
    !Array.isArray(v.item_ids) ||
    !v.item_ids.every((id) => typeof id === 'string')
  )
    return null
  return {
    id: v.id,
    name: v.name,
    kind: v.kind,
    yearStart: v.year_start as number | null,
    archived: v.archived,
    periodKind: v.period_kind === 'calendar' ? 'calendar' : 'academic',
    itemIds: v.item_ids,
  }
}
export async function listCollections(
  client: ApiClient,
): Promise<Outcome<WorkspaceCollection[]>> {
  const result = await client.request('GET', '/collections')
  if (!result.ok) return result
  if (!Array.isArray(result.data))
    return { ok: false, error: unexpectedResponse(result.status) }
  const values = result.data.map(parseCollection)
  return values.every((v): v is WorkspaceCollection => v !== null)
    ? { ok: true, value: values }
    : { ok: false, error: unexpectedResponse(result.status) }
}
export async function saveCollection(
  client: ApiClient,
  id: string | null,
  draft: CollectionDraft,
): Promise<Outcome<WorkspaceCollection>> {
  const result = await client.request(
    id ? 'PATCH' : 'POST',
    id ? '/collections/' + encodeURIComponent(id) : '/collections',
    {
      name: draft.name,
      kind: draft.kind,
      year_start: draft.yearStart,
      period_kind: draft.periodKind ?? 'academic',
      archived: draft.archived,
      item_ids: draft.itemIds,
    },
  )
  if (!result.ok) return result
  const value = parseCollection(result.data)
  return value
    ? { ok: true, value }
    : { ok: false, error: unexpectedResponse(result.status) }
}
export function filterCollectionItems<T extends { id: string; name: string }>(
  items: readonly T[],
  collections: readonly WorkspaceCollection[],
  selection: string,
  year: string,
  archive: string,
  query: string,
): T[] {
  const filtered = collections.filter(
    (c) =>
      (year === 'all' ||
        String(c.yearStart) === year ||
        periodKey(c) === year) &&
      (archive === 'all' || c.archived === (archive === 'archived')),
  )
  const selected = filtered.filter(
    (c) => selection === 'all' || c.id === selection,
  )
  const q = query.trim().toLocaleLowerCase()
  const ids = new Set(
    selected
      .filter((c) => !q || c.name.toLocaleLowerCase().includes(q))
      .flatMap((c) => c.itemIds),
  )
  const scopedIds = new Set(selected.flatMap((c) => c.itemIds))
  const allGrouped = new Set(collections.flatMap((c) => c.itemIds))
  const yearOf = (id: string) =>
    Math.max(
      0,
      ...selected
        .filter((c) => c.itemIds.includes(id))
        .map((c) => c.yearStart ?? 0),
    )
  return items
    .filter((item) => {
      const included =
        selection === 'unassigned'
          ? !allGrouped.has(item.id) &&
            (year === 'all' || year === 'null') &&
            archive !== 'archived'
          : scopedIds.has(item.id) ||
            (selection === 'all' &&
              (year === 'all' || year === 'null') &&
              archive !== 'archived' &&
              !allGrouped.has(item.id))
      return (
        included &&
        (!q || item.name.toLocaleLowerCase().includes(q) || ids.has(item.id))
      )
    })
    .sort((a, b) => yearOf(b.id) - yearOf(a.id) || a.name.localeCompare(b.name))
}

/** Une seule carte par espace, dans son regroupement pertinent le plus récent. */
export function workspaceSections<T extends { id: string }>(
  items: readonly T[],
  collections: readonly WorkspaceCollection[],
): { collection: WorkspaceCollection | null; items: T[] }[] {
  const sorted = [...collections].sort(
    (a, b) =>
      (b.yearStart ?? 0) - (a.yearStart ?? 0) || a.name.localeCompare(b.name),
  )
  const used = new Set<string>(),
    sections: { collection: WorkspaceCollection | null; items: T[] }[] = []
  for (const collection of sorted) {
    const members = items.filter(
      (item) => !used.has(item.id) && collection.itemIds.includes(item.id),
    )
    if (members.length) {
      members.forEach((item) => used.add(item.id))
      sections.push({ collection, items: members })
    }
  }
  const other = items.filter((item) => !used.has(item.id))
  if (other.length) sections.push({ collection: null, items: other })
  return sections
}

export async function saveCollectionSettings(
  client: ApiClient,
  id: string,
  settings: {
    name?: string
    year_start?: number | null
    period_kind?: 'academic' | 'calendar'
    archived?: boolean
  },
): Promise<Outcome<WorkspaceCollection>> {
  const result = await client.request(
    'PATCH',
    '/collections/' + encodeURIComponent(id) + '/settings',
    settings,
  )
  if (!result.ok) return result
  const value = parseCollection(result.data)
  return value
    ? { ok: true, value }
    : { ok: false, error: unexpectedResponse(result.status) }
}
