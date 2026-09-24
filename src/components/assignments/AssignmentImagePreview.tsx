import { useEffect, useState } from 'react'
import type { ApiClient } from '../../lib/apiClient'
import { fetchAssignmentImage } from '../../lib/assignmentsApi'

interface AssignmentImagePreviewProps {
  client: ApiClient
  assignmentId: string
  /** Titre du devoir, repris dans la description de l'image. */
  title: string
}

/**
 * Image d'un devoir, en lecture. Le serveur ne la sert qu'avec le jeton :
 * elle passe par la couche réseau, s'affiche depuis la mémoire du
 * navigateur, et son adresse est libérée au démontage.
 */
export function AssignmentImagePreview({ client, assignmentId, title }: AssignmentImagePreviewProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let url: string | null = null
    let active = true
    void fetchAssignmentImage(client, assignmentId).then((result) => {
      if (!active) return
      if (result.ok) {
        url = URL.createObjectURL(result.value)
        setPreview(url)
      } else {
        setError(result.error.message)
      }
    })
    return () => {
      active = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [client, assignmentId])

  if (error) {
    return (
      <p role="alert" className="text-sm font-medium text-danger">
        <span aria-hidden="true">✕ </span>
        {error}
      </p>
    )
  }

  return (
    <div className="max-w-md overflow-hidden rounded-card border border-line bg-surface-soft">
      {preview ? (
        <img src={preview} alt={`Image du devoir ${title}`} className="block h-auto w-full" />
      ) : (
        <p role="status" className="p-4 text-sm text-ink-soft">
          Chargement de l'image…
        </p>
      )}
    </div>
  )
}
