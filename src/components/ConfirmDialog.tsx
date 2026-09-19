import { useEffect, useId, useRef } from 'react'
import { buttonClass } from './ui/buttonClass'

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
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-card border border-line bg-surface p-0 text-ink shadow-lift backdrop:bg-[rgb(var(--c-shadow)/0.45)]"
    >
      <div className="p-6">
        <h2 id={titleId} className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-ink-soft">{message}</p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className={buttonClass({ variant: 'secondary' })}
          >
            Annuler
          </button>
          {secondaryLabel && onSecondary && (
            <button
              type="button"
              onClick={onSecondary}
              className={buttonClass({ variant: 'soft' })}
            >
              {secondaryLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className={buttonClass({ variant: 'danger' })}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
