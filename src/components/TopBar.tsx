import type { McdEditorState } from '../model/mcdReducer'
import type { MpdSettings } from '../model/mpd'
import type { SaveStatus } from '../lib/documentRepository'
import { AccountStatus } from './AccountStatus'
import { FileActions } from './FileActions'
import { DocumentNameField } from './DocumentNameField'
import { SyncStatus } from './SyncStatus'
import { UiScaleControl } from './UiScaleControl'
import { Logo } from './Logo'

interface TopBarProps {
  state: McdEditorState
  mpdSettings: MpdSettings
  documentName: string
  onRename: (name: string) => Promise<boolean>
  onBackToDocuments: () => void
  onNewDocument: () => void
  onImportFile: (file: File) => Promise<string | null>
  /** État de la sauvegarde automatique du document. */
  syncStatus: SaveStatus
  onRetrySync: () => void
  /** Espace cloud : l'état d'envoi est affiché. */
  cloud: boolean
  mcdVisible: boolean
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
}

const iconProps = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

const undoButtonClass =
  'rounded-md border border-line bg-surface p-1.5 hover:bg-shell disabled:cursor-not-allowed disabled:opacity-40'

/**
 * Barre supérieure de l'éditeur : marque, retour aux documents, nom du
 * document courant, annuler/rétablir, actions fichier.
 */
export function TopBar({
  state,
  mpdSettings,
  documentName,
  onRename,
  onBackToDocuments,
  onNewDocument,
  onImportFile,
  syncStatus,
  onRetrySync,
  cloud,
  mcdVisible,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: TopBarProps) {
  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface px-4 py-2">
      <h1 className="flex items-center gap-2 text-base font-semibold tracking-tight">
        <Logo />
        Meriz
      </h1>
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onBackToDocuments}
          className="flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm hover:bg-shell"
        >
          <svg {...iconProps}>
            <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z" />
          </svg>
          Mes documents
        </button>
        <DocumentNameField name={documentName} onRename={onRename} />
      </div>
      <div role="group" aria-label="Historique" className="flex gap-1">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Annuler (Ctrl+Z)"
          title="Annuler (Ctrl+Z)"
          aria-keyshortcuts="Control+Z"
          className={undoButtonClass}
        >
          <svg {...iconProps}>
            <path d="M8.5 5 4 9.5 8.5 14" />
            <path d="M4 9.5h10a6 6 0 0 1 0 12h-3" transform="translate(0,-2.5)" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          aria-label="Rétablir (Ctrl+Y)"
          title="Rétablir (Ctrl+Y)"
          aria-keyshortcuts="Control+Y"
          className={undoButtonClass}
        >
          <svg {...iconProps}>
            <path d="M15.5 5 20 9.5 15.5 14" />
            <path d="M20 9.5H10a6 6 0 0 0 0 12h3" transform="translate(0,-2.5)" />
          </svg>
        </button>
      </div>
      <FileActions
        state={state}
        mpdSettings={mpdSettings}
        documentName={documentName}
        mcdVisible={mcdVisible}
        onNewDocument={onNewDocument}
        onImportFile={onImportFile}
      />
      <SyncStatus status={syncStatus} onRetry={onRetrySync} cloud={cloud} />
      <div className="ml-auto flex flex-wrap items-center gap-3">
        <AccountStatus compact />
        <UiScaleControl />
      </div>
    </header>
  )
}
