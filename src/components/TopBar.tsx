import type { McdEditorState } from '../model/mcdReducer'
import type { MpdSettings } from '../model/mpd'
import type { SaveStatus } from '../lib/documentRepository'
import { AccountStatus } from './AccountStatus'
import { FileActions } from './FileActions'
import { DocumentNameField } from './DocumentNameField'
import { SyncStatus } from './SyncStatus'
import { UiScaleControl } from './UiScaleControl'
import { Badge } from './ui/Badge'
import { Lockup } from './ui/Lockup'
import { ThemeToggle } from './ui/ThemeToggle'

interface TopBarProps {
  state: McdEditorState
  mpdSettings: MpdSettings
  documentName: string
  /** Renommage : absent quand le contenu n'est pas un document personnel. */
  onRename?: (name: string) => Promise<boolean>
  onBackToDocuments: () => void
  /** Nature du contenu ouvert (ex. « Base du devoir »), quand ce n'est pas un document. */
  contentLabel?: string
  /** Libellé du bouton de retour, adapté à la page d'origine. */
  backLabel?: string
  onNewDocument?: () => void
  onImportFile?: (file: File) => Promise<string | null>
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
  'inline-flex min-h-9 min-w-9 items-center justify-center rounded-control border border-line-strong bg-surface text-ink transition-colors duration-150 hover:bg-surface-soft hover:text-ink disabled:cursor-not-allowed disabled:opacity-40'

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
  contentLabel,
  backLabel = 'Retour',
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
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface px-4 py-2 text-ink">
      <h1 className="flex items-center">
        <Lockup size={26} label="Meriz" />
      </h1>
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onBackToDocuments}
          aria-label={` : fermer le modèle et revenir à la page précédente`}
          title="Fermer le modèle et revenir à la page précédente"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-control border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium text-ink transition-colors duration-150 hover:bg-surface-soft hover:text-ink"
        >
          <svg {...iconProps}>
            <path d="M15 5 8 12l7 7" />
          </svg>
          {backLabel}
        </button>
        {onRename ? (
          <DocumentNameField name={documentName} onRename={onRename} />
        ) : (
          // Base ou corrigé d'un devoir : le titre vient du devoir, il ne
          // se renomme pas depuis l'outil de dessin.
          <p className="flex min-w-0 items-center gap-2">
            {contentLabel && <Badge tone="accent">{contentLabel}</Badge>}
            <span className="truncate text-sm font-semibold text-ink">{documentName}</span>
          </p>
        )}
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
        <ThemeToggle />
        <UiScaleControl />
      </div>
    </header>
  )
}
