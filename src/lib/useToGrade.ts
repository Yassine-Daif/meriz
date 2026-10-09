import { useCallback, useEffect, useState } from 'react'
import type { ApiClient } from './apiClient'
import { listToGrade } from './overviewApi'
import type { ToGradeRow } from './overviewApi'

export interface ToGradeState {
  /** null tant que la première page n'est pas arrivée. */
  rows: ToGradeRow[] | null
  /** Le total de rendus en attente, toutes pages confondues. */
  total: number
  error: string | null
  reload: () => Promise<void>
}

/**
 * Les rendus qui attendent une note, pour le tableau de bord du prof.
 * Une seule page suffit : elle porte les premières lignes à montrer et
 * le total à afficher en chiffre. La page À corriger, elle, pagine.
 */
export function useToGrade(client: ApiClient, enabled = true): ToGradeState {
  const [rows, setRows] = useState<ToGradeRow[] | null>(null)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!enabled) return
    setError(null)
    const result = await listToGrade(client)
    if (result.ok) {
      setRows(result.value.rows)
      setTotal(result.value.total)
    } else {
      setError(result.error.message)
    }
  }, [client, enabled])

  useEffect(() => {
    void reload()
  }, [reload])

  return { rows, total, error, reload }
}
