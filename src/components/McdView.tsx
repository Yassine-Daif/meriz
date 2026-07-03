import { useState } from 'react'
import type { Dispatch, KeyboardEvent, PointerEvent, SetStateAction } from 'react'
import type { McdAction, McdEditorState } from '../model/mcdReducer'
import type { ValidationProblem } from '../model/validate'
import { McdCanvas } from '../canvas/McdCanvas'
import type { CanvasSelection } from '../canvas/selection'
import { McdToolbar } from './McdToolbar'
import { Inspector } from './Inspector'
import { ProblemsPanel } from './ProblemsPanel'

const PANEL_MIN = 240
const PANEL_MAX = 640
const PANEL_STEP = 16

function clampWidth(width: number): number {
  return Math.min(PANEL_MAX, Math.max(PANEL_MIN, width))
}

interface McdViewProps {
  state: McdEditorState
  dispatch: Dispatch<McdAction>
  selection: CanvasSelection
  onSelectionChange: Dispatch<SetStateAction<CanvasSelection>>
  problems: ValidationProblem[]
  onSelectElement: (elementId: string) => void
  onGenerate: () => void
  /**
   * La vue reste montée quand elle est inactive (le zoom et la
   * position du canvas survivent), simplement masquée.
   */
  isActive: boolean
}

/**
 * Vue MCD : sous-barre d'outils, canvas, et un panneau latéral
 * redimensionnable qui empile l'inspecteur et la validation.
 */
export function McdView({
  state,
  dispatch,
  selection,
  onSelectionChange,
  problems,
  onSelectElement,
  onGenerate,
  isActive,
}: McdViewProps) {
  const [panelWidth, setPanelWidth] = useState(300)

  const onSeparatorPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = panelWidth
    const separator = event.currentTarget
    separator.setPointerCapture(event.pointerId)
    const onMove = (moveEvent: globalThis.PointerEvent) => {
      setPanelWidth(clampWidth(startWidth + (startX - moveEvent.clientX)))
    }
    const onUp = () => {
      separator.removeEventListener('pointermove', onMove)
    }
    separator.addEventListener('pointermove', onMove)
    separator.addEventListener('pointerup', onUp, { once: true })
  }

  const onSeparatorKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Poignée à gauche du panneau : flèche gauche = panneau plus large.
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      setPanelWidth((width) => clampWidth(width + PANEL_STEP))
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      setPanelWidth((width) => clampWidth(width - PANEL_STEP))
    }
  }

  return (
    <section
      aria-label="Vue MCD"
      className={isActive ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}
    >
      <McdToolbar dispatch={dispatch} problems={problems} onGenerate={onGenerate} />
      <div className="flex min-h-0 flex-1">
        <McdCanvas
          state={state}
          dispatch={dispatch}
          selection={selection}
          onSelectionChange={onSelectionChange}
          isActive={isActive}
        />
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Redimensionner le panneau latéral"
          aria-valuemin={PANEL_MIN}
          aria-valuemax={PANEL_MAX}
          aria-valuenow={panelWidth}
          tabIndex={0}
          onPointerDown={onSeparatorPointerDown}
          onKeyDown={onSeparatorKeyDown}
          className="w-1.5 shrink-0 cursor-col-resize bg-line hover:bg-indigo-400"
        />
        <div
          style={{ width: panelWidth, maxWidth: '60vw' }}
          className="flex shrink-0 flex-col overflow-y-auto bg-surface"
        >
          <Inspector mcd={state.mcd} selection={selection} dispatch={dispatch} />
          <ProblemsPanel problems={problems} mcd={state.mcd} onSelectElement={onSelectElement} />
        </div>
      </div>
    </section>
  )
}
