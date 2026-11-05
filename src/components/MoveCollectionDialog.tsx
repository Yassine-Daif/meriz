import { useEffect, useId, useRef } from 'react'
import { t } from '../i18n/runtime'
import { useLanguage } from '../lib/useLanguage'
import { dialogClass } from './ui/dialogClass'
import { Select } from './ui/Select'
import { Button } from './ui/Button'
export function MoveCollectionDialog({
  name,
  destination,
  pending,
  error,
  onDestination,
  onCancel,
  onConfirm,
  options,
}: {
  name: string
  destination: string
  pending: boolean
  error: string | null
  onDestination: (value: string) => void
  onCancel: () => void
  onConfirm: () => void
  options: readonly { id: string; name: string }[]
}) {
  useLanguage()
  const ref = useRef<HTMLDialogElement>(null),
    id = useId()
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      className={dialogClass('sm')}
      onCancel={(e) => {
        e.preventDefault()
        if (!pending) onCancel()
      }}
    >
      <div className="space-y-4 p-5">
        <h2 id={id} className="break-words text-lg font-semibold">
          {t('Déplacer {0}', [name])}
        </h2>
        <label className="flex min-w-0 flex-col gap-1 text-sm">
          {t('Destination')}
          <Select
            value={destination}
            disabled={pending}
            onValueChange={onDestination}
          >
            <option value="" disabled>
              {t('Choisir un regroupement')}
            </option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </label>
        <p className="text-xs text-ink-soft">
          {t(
            'Un déplacement retire uniquement le classement de départ. Les autres classements sont conservés.',
          )}
        </p>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!destination}
            loading={pending}
            variant="primary"
            onClick={onConfirm}
          >
            {t('Confirmer le déplacement')}
          </Button>
          <Button disabled={pending} onClick={onCancel}>
            {t('Annuler')}
          </Button>
        </div>
      </div>
    </dialog>
  )
}
