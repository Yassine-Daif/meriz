import { useEffect, useState } from 'react'
import type { ApiClient } from '../../lib/apiClient'
import { fetchAssignmentImage, removeAssignmentImage, uploadAssignmentImage } from '../../lib/assignmentsApi'
import type { Assignment } from '../../lib/assignmentsApi'
import { ConfirmDialog } from '../ConfirmDialog'
import { ImportFileButton } from '../ImportFileButton'
import { Button } from '../ui/Button'
import { buttonClass } from '../ui/buttonClass'

interface AssignmentImageFieldProps {
  client: ApiClient
  assignment: Assignment
  /** Devoir renvoyé par le serveur après l'envoi ou le retrait. */
  onChanged: (assignment: Assignment) => void
}

/**
 * Image du devoir. Le serveur ne la sert qu'avec le jeton : on la lit
 * donc par la couche réseau, puis on l'affiche depuis la mémoire du
 * navigateur, en libérant l'adresse au démontage.
 */
export function AssignmentImageField({ client, assignment, onChanged }: AssignmentImageFieldProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const hasImage = assignment.hasImage
  const assignmentId = assignment.id

  useEffect(() => {
    if (!hasImage) {
      setPreview(null)
      return
    }
    let url: string | null = null
    let active = true
    void fetchAssignmentImage(client, assignmentId).then((result) => {
      if (!active) return
      if (result.ok) {
        url = URL.createObjectURL(result.value)
        setPreview(url)
      } else {
        setPreview(null)
        setError(result.error.message)
      }
    })
    return () => {
      active = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [client, assignmentId, hasImage, assignment.updatedAt])

  const upload = async (file: File) => {
    if (busy) return
    setBusy(true)
    setError(null)
    const result = await uploadAssignmentImage(client, assignmentId, file)
    setBusy(false)
    if (result.ok) onChanged(result.value)
    else setError(result.error.fieldErrors.image?.[0] ?? result.error.message)
  }

  const remove = async () => {
    setConfirmRemove(false)
    if (busy) return
    setBusy(true)
    setError(null)
    const result = await removeAssignmentImage(client, assignmentId)
    setBusy(false)
    if (result.ok) onChanged(result.value)
    else setError(result.error.message)
  }

  return (
    <div className="flex flex-col gap-3">
      {hasImage && (
        <div className="max-w-md overflow-hidden rounded-card border border-line bg-surface-soft">
          {preview ? (
            <img src={preview} alt={`Image du devoir ${assignment.title}`} className="block h-auto w-full" />
          ) : (
            <p role="status" className="p-4 text-sm text-ink-soft">
              Chargement de l'image…
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <ImportFileButton
          className={buttonClass({ variant: hasImage ? 'secondary' : 'primary' })}
          accept="image/jpeg,image/png,image/webp"
          onFile={(file) => void upload(file)}
        >
          {hasImage ? "Remplacer l'image" : 'Ajouter une image'}
        </ImportFileButton>
        {hasImage && (
          <Button variant="ghost" onClick={() => setConfirmRemove(true)} disabled={busy}>
            Retirer l'image
          </Button>
        )}
        <p role="status" aria-live="polite" className="text-sm text-ink-soft empty:hidden">
          {busy ? 'Envoi…' : ''}
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          <span aria-hidden="true">✕ </span>
          {error}
        </p>
      )}

      <ConfirmDialog
        open={confirmRemove}
        title="Retirer l'image"
        message="L'image sera supprimée du devoir. Vous pourrez en envoyer une autre."
        confirmLabel="Retirer l'image"
        onConfirm={() => void remove()}
        onCancel={() => setConfirmRemove(false)}
      />
    </div>
  )
}
