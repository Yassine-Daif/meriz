import { useCallback, useEffect, useState } from 'react'
import type { ApiClient } from '../lib/apiClient'
import { filterCollectionItems, listCollections } from '../lib/collectionsApi'
import type { CollectionKind, WorkspaceCollection } from '../lib/collectionsApi'

const listeners = new WeakMap<ApiClient, Set<() => void>>()

export function useCollections(client: ApiClient, kind: CollectionKind) {
  const [collections, setCollections] = useState<WorkspaceCollection[]>([])
  const [error, setError] = useState<string | null>(null)
  const [selection, setSelection] = useState('all'),
    [year, setYear] = useState('all'),
    [archive, setArchive] = useState('active')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    void listCollections(client).then((result) => {
      if (!active) return
      if (result.ok) {
        setCollections(result.value.filter((c) => c.kind === kind))
        setError(null)
      } else setError(result.error.message)
    })
    return () => {
      active = false
    }
  }, [client, kind, revision])
  useEffect(() => {
    const callbacks = listeners.get(client) ?? new Set<() => void>()
    listeners.set(client, callbacks)
    const refresh = () => setRevision((v) => v + 1)
    callbacks.add(refresh)
    return () => {
      callbacks.delete(refresh)
    }
  }, [client])
  const refresh = useCallback(async () => {
    const result = await listCollections(client)
    if (result.ok) {
      setCollections(result.value.filter((c) => c.kind === kind))
      setError(null)
    } else setError(result.error.message)
    return result.ok
  }, [client, kind])
  const reload = useCallback(() => {
    listeners.get(client)?.forEach((callback) => callback())
  }, [client])
  const filter = <T extends { id: string; name: string }>(
    items: readonly T[],
    query: string,
  ) =>
    filterCollectionItems(items, collections, selection, year, archive, query)
  return {
    collections,
    error,
    selection,
    setSelection,
    year,
    setYear,
    archive,
    setArchive,
    reload,
    refresh,
    filter,
  }
}
