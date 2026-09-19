import { useCallback, useEffect, useState } from 'react'
import type { ApiClient } from './apiClient'
import { listClassrooms } from './classroomsApi'
import type { ClassroomSummary } from './classroomsApi'

export interface ClassroomsState {
  /** null tant que la liste n'est pas arrivée. */
  classrooms: ClassroomSummary[] | null
  error: string | null
  reload: () => Promise<void>
}

/**
 * Classes du compte connecté, relues auprès du serveur à chaque montage.
 * Rien n'est gardé dans le navigateur : un autre compte ne les voit jamais.
 */
export function useClassrooms(client: ApiClient): ClassroomsState {
  const [classrooms, setClassrooms] = useState<ClassroomSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setError(null)
    const result = await listClassrooms(client)
    if (result.ok) {
      setClassrooms(result.value)
    } else {
      setError(result.error.message)
    }
  }, [client])

  useEffect(() => {
    void reload()
  }, [reload])

  return { classrooms, error, reload }
}
