import { useCallback, useEffect, useState } from 'react'
import type { ApiClient } from './apiClient'
import { listGroups } from './groupsApi'
import type { GroupSummary } from './groupsApi'

export interface GroupsState {
  /** null tant que la liste n'est pas arrivée. */
  groups: GroupSummary[] | null
  error: string | null
  reload: () => Promise<void>
}

/**
 * Groupes du compte connecté, relus auprès du serveur à chaque montage.
 * Rien n'est gardé dans le navigateur : un autre compte ne les voit jamais.
 */
export function useGroups(client: ApiClient): GroupsState {
  const [groups, setGroups] = useState<GroupSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setError(null)
    const result = await listGroups(client)
    if (result.ok) {
      setGroups(result.value)
    } else {
      setError(result.error.message)
    }
  }, [client])

  useEffect(() => {
    void reload()
  }, [reload])

  return { groups, error, reload }
}
