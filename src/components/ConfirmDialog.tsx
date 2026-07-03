import { useEffect, useId, useRef } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  /** Libellé du bouton d'action destructrice (rouge). */
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  /** Action intermédiaire optionnelle (ex. « Enregistrer d'abord »). */
  secondaryLabel?: string
  onSecondary?: () => void
}

/**
 * Petite boîte de confirmation modale, sur l'élément natif <dialog> :
 * focus piégé, Échap pour annuler, fond assombri. Le bouton destructeur
 * est rouge, Annuler garde le focus initial (choix sûr par défaut).
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  secondaryLabel,
  onSecondary,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) {
      return
    }
    if (open && !dialog.open) {
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Échap : on passe par le même chemin que le bouton Annuler.
        event.preventDefault()
        onCancel()
      }}
      className="m-auto w-full max-w-sm rounded-lg border border-line bg-surface p-0 shadow-xl backdrop:bg-zinc-900/40"
    >
      <div className="p-5">
        <h2 id={titleId} className="text-base font-semibold tracking-tight">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-700">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm hover:bg-shell"
          >
            Annuler
          </button>
          {secondaryLabel && onSecondary && (
            <button
              type="button"
              onClick={onSecondary}
              className="rounded-md border border-indigo-700 bg-surface px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
            >
              {secondaryLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md border border-rose-700 bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
