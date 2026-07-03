import { useContext, useState } from 'react'
import type { PointerEvent } from 'react'
import { BaseEdge, EdgeLabelRenderer, useReactFlow } from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'
import type { LegFlowEdge } from './mcdToFlow'
import { McdDispatchContext } from './dispatchContext'
import type { Position } from '../model/layout'

/**
 * Lien patte : trait entre une association et une entité, avec une
 * étiquette de cardinalité (et de rôle) déplaçable. Quand on la
 * déplace, la ligne se courbe pour passer par elle ; sa position est
 * enregistrée dans le layout (donc annulable et sauvegardée).
 */
export function LegEdge({ id, sourceX, sourceY, targetX, targetY, data, selected }: EdgeProps<LegFlowEdge>) {
  const dispatch = useContext(McdDispatchContext)
  const { screenToFlowPosition } = useReactFlow()
  const [dragPosition, setDragPosition] = useState<Position | null>(null)

  // Position par défaut : aux trois quarts du chemin, côté entité.
  const defaultLabel = {
    x: sourceX + (targetX - sourceX) * 0.75,
    y: sourceY + (targetY - sourceY) * 0.75,
  }
  const label = dragPosition ?? data?.labelPosition ?? defaultLabel

  // Courbe quadratique qui passe par l'étiquette (à mi-parcours).
  // Étiquette sur la ligne droite → la courbe reste une droite.
  const controlX = 2 * label.x - (sourceX + targetX) / 2
  const controlY = 2 * label.y - (sourceY + targetY) / 2
  const path = `M ${sourceX},${sourceY} Q ${controlX},${controlY} ${targetX},${targetY}`

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragPosition(label)
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      return
    }
    setDragPosition(screenToFlowPosition({ x: event.clientX, y: event.clientY }))
  }
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      return
    }
    event.currentTarget.releasePointerCapture(event.pointerId)
    if (dragPosition && dispatch) {
      // La position de l'étiquette vit dans le layout, indexée par
      // l'id de la patte : même canal que les nœuds, même undo.
      dispatch({ type: 'MOVE_NODE', id, position: dragPosition })
    }
    setDragPosition(null)
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={
          selected
            ? { stroke: '#4338ca', strokeWidth: 2 }
            : { stroke: '#a1a1aa', strokeWidth: 1.25 }
        }
      />
      {data && (
        <EdgeLabelRenderer>
          <div
            style={{
              transform: `translate(-50%, -50%) translate(${label.x}px, ${label.y}px)`,
              pointerEvents: 'all',
            }}
            className={`nodrag nopan absolute cursor-move touch-none rounded-sm border bg-surface px-1 font-mono text-[11px] ${
              selected ? 'border-indigo-700 text-indigo-700' : 'border-zinc-300 text-ink'
            }`}
            title="Glisser pour déplacer l'étiquette"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            {data.cardinality.min},{data.cardinality.max}
            {data.role !== undefined && ` · ${data.role}`}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
