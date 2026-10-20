import { useId, useRef } from 'react'
import { motionStore } from '../../lib/motion'
import { useMotion } from '../../lib/useMotion'
import { ToggleSwitch } from '../ToggleSwitch'
import { Button } from './Button'
import { dialogClass } from './dialogClass'

/** Réglage disponible avec ou sans compte, dans le navigateur comme sur le bureau. */
export function EffectsControl() {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const { preference, reduced } = useMotion()
  return (
    <>
      <Button size="sm" variant="ghost" aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
          <path d="m10 3 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" />
          <path d="m19 2 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z" />
        </svg>
        Effets
      </Button>
      <dialog ref={dialog} aria-labelledby={titleId} className={dialogClass('sm')}>
        <div className="p-6">
          <h2 id={titleId} className="text-lg font-semibold tracking-tight">Un peu de douceur</h2>
          <p className="mt-2 text-sm leading-6 text-ink-soft">
            Des transitions courtes à l’ouverture des pages et des fenêtres, et des réactions discrètes au survol.
          </p>
          <div className="mt-5">
            <ToggleSwitch label="Animer l’interface" checked={preference} onChange={motionStore.setPreference}
              description="Votre choix est mémorisé sur cet appareil, sans compte." />
          </div>
          {reduced && <p role="status" className="mt-4 rounded-control bg-accent-soft p-3 text-sm text-ink">
            Votre système demande de réduire les mouvements : les animations restent désactivées.
          </p>}
          <div className="mt-6 flex justify-end">
            <Button onClick={() => dialog.current?.close()}>Fermer</Button>
          </div>
        </div>
      </dialog>
    </>
  )
}
