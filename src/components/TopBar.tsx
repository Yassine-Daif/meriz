import type { Dispatch } from 'react'
import type { McdAction, McdEditorState } from '../model/mcdReducer'
import { FileActions } from './FileActions'
import { UiScaleControl } from './UiScaleControl'
import { Logo } from './Logo'

interface TopBarProps {
  state: McdEditorState
  dispatch: Dispatch<McdAction>
  onModelReplaced: () => void
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

/** Barre supérieure : marque, annuler/rétablir, actions fichier, validation. */
export function TopBar({
  state,
  dispatch,
  onModelReplaced,
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
        dispatch={dispatch}
        onModelReplaced={onModelReplaced}
        mcdVisible={mcdVisible}
      />
      <div className="ml-auto">
        <UiScaleControl />
      </div>
    </header>
  )
}
