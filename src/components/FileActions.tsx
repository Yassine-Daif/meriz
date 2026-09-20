import { useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { McdEditorState } from '../model/mcdReducer'
import type { MpdSettings } from '../model/mpd'
import { fileNameFor, serializeModel } from '../lib/persistence'
import { exportToPng } from '../lib/exportImage'
import { saveFileAs } from '../lib/download'
import { ImportFileButton } from './ImportFileButton'

interface FileActionsProps {
  state: McdEditorState
  /** Réglages MPD (dialecte, surcharges de types), enregistrés avec le modèle. */
  mpdSettings: MpdSettings
  /** Nom du document : il nomme le fichier exporté et y est enregistré. */
  documentName: string
  /** L'export PNG capture le DOM du canvas : il faut la vue MCD affichée. */
  mcdVisible: boolean
  /** Crée un nouveau document et l'ouvre. Absent hors de l'espace documents. */
  onNewDocument?: () => void
  /** Importe un fichier comme nouveau document : message d'erreur, ou null. */
  onImportFile?: (file: File) => Promise<string | null>
}

interface StatusMessage {
  kind: 'info' | 'error'
  text: string
}

const buttonClass =
  'rounded-control border border-line bg-surface px-2.5 py-1.5 text-sm hover:bg-shell'

/**
 * Actions fichier du document courant : Nouveau et Ouvrir créent un
 * autre document (le courant est déjà sauvegardé), Enregistrer exporte
 * le document en fichier, Exporter en image produit un PNG du MCD.
 */
export function FileActions({
  state,
  mpdSettings,
  documentName,
  mcdVisible,
  onNewDocument,
  onImportFile,
}: FileActionsProps) {
  const [status, setStatus] = useState<StatusMessage | null>(null)
  const { getNodes } = useReactFlow()

  const handleSave = async () => {
    const blob = new Blob([serializeModel(state, mpdSettings, documentName)], {
      type: 'application/json',
    })
    const result = await saveFileAs(fileNameFor(documentName), blob, 'Modèle Meriz', {
      'application/json': ['.json'],
    })
    if (result === 'cancelled') {
      setStatus({ kind: 'info', text: 'Enregistrement annulé.' })
    } else {
      setStatus({
        kind: 'info',
        text: result === 'saved' ? 'Document enregistré en fichier.' : 'Document téléchargé.',
      })
    }
  }

  const handleImport = async (file: File) => {
    if (!onImportFile) return
    const error = await onImportFile(file)
    if (error) {
      // Fichier invalide : message clair, le document courant reste ouvert.
      setStatus({ kind: 'error', text: `Erreur : ${error}` })
    }
  }

  const handleExport = async () => {
    if (!mcdVisible) {
      setStatus({ kind: 'error', text: "Erreur : ouvrez la vue MCD pour exporter l'image." })
      return
    }
    const nodes = getNodes()
    if (nodes.length === 0) {
      setStatus({ kind: 'error', text: 'Erreur : rien à exporter, le modèle est vide.' })
      return
    }
    const viewportElement = document.querySelector<HTMLElement>('.react-flow__viewport')
    if (!viewportElement) {
      setStatus({ kind: 'error', text: "Erreur : la zone de dessin est introuvable." })
      return
    }
    try {
      const dataUrl = await exportToPng(nodes, viewportElement)
      const blob = await (await fetch(dataUrl)).blob()
      const imageName = fileNameFor(documentName).replace(/\.meriz\.json$/, '.png')
      const result = await saveFileAs(imageName, blob, 'Image PNG', { 'image/png': ['.png'] })
      if (result === 'cancelled') {
        setStatus({ kind: 'info', text: 'Export annulé.' })
      } else {
        setStatus({ kind: 'info', text: 'Image PNG exportée.' })
      }
    } catch {
      setStatus({ kind: 'error', text: "Erreur : l'export de l'image a échoué." })
    }
  }

  return (
    <div role="group" aria-label="Fichier" className="flex flex-wrap items-center gap-2">
      {onNewDocument && (
        <button type="button" className={buttonClass} onClick={onNewDocument}>
          Nouveau
        </button>
      )}
      {onImportFile && (
        <ImportFileButton className={buttonClass} onFile={(file) => void handleImport(file)}>
          Ouvrir
        </ImportFileButton>
      )}
      <button type="button" className={buttonClass} onClick={() => void handleSave()}>
        Enregistrer
      </button>
      <button type="button" className={buttonClass} onClick={() => void handleExport()}>
        Exporter en image
      </button>
      <p role="status" aria-live="polite" className="min-w-0 text-xs text-ink-soft">
        {status && (
          <span
            className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 ${
              status.kind === 'error' ? 'border-warning bg-warning-soft' : 'border-line-strong bg-surface-soft'
            }`}
          >
            <span aria-hidden="true">{status.kind === 'error' ? '⚠' : '✓'}</span>
            {status.text}
          </span>
        )}
      </p>
    </div>
  )
}
