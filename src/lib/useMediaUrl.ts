import { useEffect, useState } from 'react'
import type { ApiClient } from './apiClient'
import { fetchLessonMedium } from './lessonsApi'

/**
 * Charge un fichier d'un cours pour l'afficher. Le serveur ne le sert
 * qu'avec le jeton : une balise img ou audio ne peut pas le demander
 * seule. On passe donc par la couche réseau, on garde l'adresse locale du
 * contenu, et on la libère au démontage.
 */

export interface MediaUrlState {
  /** Adresse locale à donner à une balise img ou audio. */
  url: string | null
  loading: boolean
  error: string | null
}

export function useMediaUrl(
  client: ApiClient,
  lessonId: string,
  /** Fichier à charger, ou null quand le bloc n'en a pas encore. */
  mediumId: string | null,
): MediaUrlState {
  const [state, setState] = useState<MediaUrlState>({ url: null, loading: mediumId !== null, error: null })

  useEffect(() => {
    if (mediumId === null) {
      setState({ url: null, loading: false, error: null })
      return
    }
    let active = true
    let created: string | null = null
    setState({ url: null, loading: true, error: null })
    void fetchLessonMedium(client, lessonId, mediumId).then((result) => {
      if (!active) return
      if (result.ok) {
        created = URL.createObjectURL(result.value)
        setState({ url: created, loading: false, error: null })
      } else {
        setState({ url: null, loading: false, error: result.error.message })
      }
    })
    return () => {
      active = false
      if (created) URL.revokeObjectURL(created)
    }
  }, [client, lessonId, mediumId])

  return state
}
