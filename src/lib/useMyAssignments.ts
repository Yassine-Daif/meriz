import { useCallback, useEffect, useState } from 'react'
import type { ApiClient } from './apiClient'
import { listMyAssignments } from './overviewApi'
import { indexAssignments } from './workAssignments'
import type { AssignmentIndex } from './workAssignments'

export interface MyAssignmentsState {
  /** null tant que la liste n'est pas arrivée, ou quand l'appel n'a pas lieu. */
  assignments: AssignmentIndex | null
  error: string | null
  reload: () => Promise<void>
}

/**
 * Les devoirs de l'élève, lus une fois au montage, pour nommer le devoir
 * d'un document de travail. L'erreur n'est pas affichée dans les listes :
 * un titre qui manque n'est pas une panne, la provenance reste juste.
 */
export function useMyAssignments(client: ApiClient, enabled = true): MyAssignmentsState {
  const [assignments, setAssignments] = useState<AssignmentIndex | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!enabled) return
    setError(null)
    const result = await listMyAssignments(client)
    if (result.ok) {
      setAssignments(indexAssignments(result.value))
    } else {
      setError(result.error.message)
    }
  }, [client, enabled])

  useEffect(() => {
    void reload()
  }, [reload])

  return { assignments, error, reload }
}
