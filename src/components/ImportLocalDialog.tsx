import { useEffect, useId, useRef } from 'react'
import type { DocumentMeta } from '../model/document'
import { primaryButtonClass, secondaryButtonClass } from './buttonStyles'

export interface ImportReport {
  imported: number
  failed: string[]
}

interface ImportLocalDialogProps {
  open: boolean
  documents: DocumentMeta[]
  /** 'ask', 'working' pendant la copie, 'done' quand le rapport est prêt. */
  phase: 'ask' | 'working' | 'done'
  progress: number
  report: ImportReport | null
  onImport: () => void
  /** Garder en local : la question ne reviendra pas pour ces documents. */
  onKeepLocal: () => void
  /** Plus tard : rien n'est marqué, la question reviendra. */
  onLater: () => void
  onClose: () => void
}

/**
 * Proposition faite une fois par compte : monter dans le compte les
 * documents de cet appareil créés avant la connexion. Les originaux
 * locaux ne sont jamais supprimés, quel que soit le choix.
 */
export function ImportLocalDialog({
  open,
  documents,
  phase,
  progress,
  report,
  onImport,
  onKeepLocal,
  onLater,
  onClose,
}: ImportLocalDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
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
        event.preventDefault()
        // Échap vaut « Plus tard » : aucun choix n'est enregistré.
        if (phase === 'done') onClose()
        else if (phase === 'ask') onLater()
      }}
      className="m-auto w-full max-w-md rounded-lg border border-line bg-surface p-0 shadow-xl backdrop:bg-zinc-900/40"
    >
      <div className="p-5">
        <h2 id={titleId} className="text-base font-semibold tracking-tight">
          {phase === 'done' ? 'Import terminé' : 'Importer vos documents de cet appareil ?'}
        </h2>

        {phase !== 'done' && (
          <>
            <p className="mt-2 text-sm leading-6 text-zinc-700">
              {documents.length === 1
                ? 'Un document a été créé sur cet appareil avant votre connexion.'
                : `${documents.length} documents ont été créés sur cet appareil avant votre connexion.`}{' '}
              Vous pouvez en placer une copie dans votre compte, pour les retrouver partout. Les
              originaux restent sur cet appareil dans tous les cas.
            </p>
            <ul className="mt-3 max-h-40 overflow-y-auto rounded border border-line bg-shell/60 p-2 text-sm">
              {documents.map((meta) => (
                <li key={meta.id} className="truncate px-1 py-0.5">
                  {meta.name}
                </li>
              ))}
            </ul>
          </>
        )}

        {phase === 'working' && (
          <p role="status" aria-live="polite" className="mt-3 text-sm text-zinc-700">
            Import {progress} sur {documents.length}…
          </p>
        )}

        {phase === 'done' && report && (
          <div role="status" aria-live="polite" className="mt-2 text-sm leading-6 text-zinc-700">
            <p>
              {report.imported === 0
                ? 'Aucun document importé.'
                : report.imported === 1
                  ? '1 document a été copié dans votre compte.'
                  : `${report.imported} documents ont été copiés dans votre compte.`}
            </p>
            {report.failed.length > 0 && (
              <p className="mt-1">
                Non importés, ils restent sur cet appareil et vous seront reproposés :{' '}
                {report.failed.join(', ')}.
              </p>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {phase === 'done' ? (
            <button type="button" onClick={onClose} className={primaryButtonClass}>
              Fermer
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onLater}
                disabled={phase === 'working'}
                className={`${secondaryButtonClass} disabled:cursor-not-allowed disabled:opacity-60`}
              >
                Plus tard
              </button>
              <button
                type="button"
                onClick={onKeepLocal}
                disabled={phase === 'working'}
                className={`${secondaryButtonClass} disabled:cursor-not-allowed disabled:opacity-60`}
              >
                Garder en local
              </button>
              <button
                type="button"
                onClick={onImport}
                disabled={phase === 'working'}
                className={primaryButtonClass}
              >
                {phase === 'working' ? 'Import…' : 'Importer dans mon compte'}
              </button>
            </>
          )}
        </div>
      </div>
    </dialog>
  )
}
