import { useRef, useState } from 'react'
import type { ChangeEvent, Dispatch } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { McdAction, McdEditorState } from '../model/mcdReducer'
import { parseModelFile, serializeModel } from '../lib/persistence'
import { exportToPng } from '../lib/exportImage'
import { saveFileAs } from '../lib/download'
import { ConfirmDialog } from './ConfirmDialog'

interface FileActionsProps {
  state: McdEditorState
  dispatch: Dispatch<McdAction>
  /** Appelé après Nouveau ou Ouvrir, pour réinitialiser la sélection. */
  onModelReplaced: () => void
  /** L'export PNG capture le DOM du canvas : il faut la vue MCD affichée. */
  mcdVisible: boolean
}

interface StatusMessage {
  kind: 'info' | 'error'
  text: string
}

const buttonClass =
  'rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm hover:bg-shell'

/** Actions fichier : Nouveau, Ouvrir, Enregistrer, Exporter en image. */
/** Action qui remplace le modèle courant, protégée par confirmation. */
type GuardedAction = 'new' | 'open'

const GUARD_TEXTS: Record<GuardedAction, { title: string; message: string; confirm: string }> = {
  new: {
    title: 'Nouveau modèle',
    message:
      "Le modèle actuel sera remplacé par un modèle vide. Enregistrez-le d'abord, ou continuez (annulable avec Ctrl+Z).",
    confirm: 'Continuer sans enregistrer',
  },
  open: {
    title: 'Ouvrir un fichier',
    message:
      "Le fichier ouvert remplacera le modèle actuel. Enregistrez-le d'abord, ou continuez (annulable avec Ctrl+Z).",
    confirm: 'Continuer sans enregistrer',
  },
}

export function FileActions({ state, dispatch, onModelReplaced, mcdVisible }: FileActionsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<StatusMessage | null>(null)
  const [pendingAction, setPendingAction] = useState<GuardedAction | null>(null)
  const { getNodes, fitView } = useReactFlow()

  const modelIsEmpty =
    state.mcd.properties.length === 0 &&
    state.mcd.entities.length === 0 &&
    state.mcd.associations.length === 0

  const runAction = (action: GuardedAction) => {
    setPendingAction(null)
    if (action === 'new') {
      dispatch({ type: 'NEW_MODEL' })
      onModelReplaced()
      setStatus({ kind: 'info', text: 'Nouveau modèle créé.' })
    } else {
      fileInputRef.current?.click()
    }
  }

  // Nouveau et Ouvrir écrasent le travail en cours : si le modèle
  // n'est pas vide, on propose d'enregistrer avant.
  const guardAction = (action: GuardedAction) => {
    if (modelIsEmpty) {
      runAction(action)
    } else {
      setPendingAction(action)
    }
  }

  const handleSave = async () => {
    const blob = new Blob([serializeModel(state)], { type: 'application/json' })
    const result = await saveFileAs('modele.meriz.json', blob, 'Modèle Meriz', {
      'application/json': ['.json'],
    })
    if (result === 'cancelled') {
      setStatus({ kind: 'info', text: 'Enregistrement annulé.' })
    } else {
      setStatus({
        kind: 'info',
        text: result === 'saved' ? 'Modèle enregistré.' : 'Modèle téléchargé.',
      })
    }
    return result
  }

  // « Enregistrer d'abord » : sauvegarde, puis déroule l'action en
  // attente. Un enregistrement annulé laisse tout en place.
  const saveThenRun = async () => {
    const action = pendingAction
    if (!action) {
      return
    }
    const result = await handleSave()
    if (result === 'cancelled') {
      setPendingAction(null)
      return
    }
    runAction(action)
  }

  const handleOpenFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // Réinitialisé tout de suite : permet de rouvrir le même fichier.
    event.target.value = ''
    if (!file) {
      return
    }
    const result = parseModelFile(await file.text())
    if (!result.ok) {
      // Fichier invalide : message clair, le modèle courant reste intact.
      setStatus({ kind: 'error', text: `Erreur : ${result.error}` })
      return
    }
    dispatch({ type: 'LOAD_MODEL', mcd: result.state.mcd, layout: result.state.layout })
    onModelReplaced()
    setStatus({ kind: 'info', text: `Modèle « ${file.name} » chargé.` })
    // Cadre la vue une fois les nœuds resynchronisés et mesurés.
    window.setTimeout(() => {
      void fitView({ padding: 0.2, maxZoom: 1 })
    }, 50)
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
      const result = await saveFileAs('mcd.png', blob, 'Image PNG', { 'image/png': ['.png'] })
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
    <div role="group" aria-label="Fichier" className="flex items-center gap-2">
      <button type="button" className={buttonClass} onClick={() => guardAction('new')}>
        Nouveau
      </button>
      <button type="button" className={buttonClass} onClick={() => guardAction('open')}>
        Ouvrir
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event) => void handleOpenFile(event)}
      />
      <button type="button" className={buttonClass} onClick={() => void handleSave()}>
        Enregistrer
      </button>
      <button type="button" className={buttonClass} onClick={() => void handleExport()}>
        Exporter en image
      </button>
      <p role="status" aria-live="polite" className="min-w-0 text-xs text-zinc-700">
        {status && (
          <span
            className={`inline-flex items-center gap-1 rounded border px-2 py-1 ${
              status.kind === 'error' ? 'border-amber-400 bg-amber-50' : 'border-zinc-300 bg-zinc-50'
            }`}
          >
            <span aria-hidden="true">{status.kind === 'error' ? '⚠' : '✓'}</span>
            {status.text}
          </span>
        )}
      </p>
      <ConfirmDialog
        open={pendingAction !== null}
        title={pendingAction ? GUARD_TEXTS[pendingAction].title : ''}
        message={pendingAction ? GUARD_TEXTS[pendingAction].message : ''}
        confirmLabel={pendingAction ? GUARD_TEXTS[pendingAction].confirm : ''}
        secondaryLabel="Enregistrer d'abord"
        onSecondary={() => void saveThenRun()}
        onConfirm={() => pendingAction && runAction(pendingAction)}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  )
}
