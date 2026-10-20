import { ViewportPortal } from '@xyflow/react'
import { anchorBox } from './anchors'
import type { McdFlowNode } from './mcdToFlow'
import type { RemotePresence } from '../model/collabProvider'
import { displayName } from '../lib/authApi'

/** Cadres statiques : aucun mouvement, y compris en mouvement réduit. */
export function RemoteSelections({ others, nodes }: { others: RemotePresence[]; nodes: McdFlowNode[] }) {
  return <ViewportPortal>
    <svg aria-label="Sélections des participants" className="pointer-events-none absolute overflow-visible"
      style={{ left: 0, top: 0, width: 1, height: 1, zIndex: 998 }}>
      {nodes.flatMap((node) => {
        const box = anchorBox(node)
        return others.filter((other) => other.selection.includes(node.id)).map((other, index) => {
          const gap = 6 + index * 5
          const name = displayName(other.user) || 'Participant'
          return <g key={node.id+':'+other.clientId} data-remote-selection={node.id} data-participant={other.user.id}
            role="img" aria-label={'Sélection de '+name}>
            <title>{'Sélection de '+name}</title>
            <rect x={box.x-gap} y={box.y-gap} width={box.width+2*gap} height={box.height+2*gap}
              rx={node.type === 'association' ? 24 : 14} fill="none" stroke={other.user.avatarBg}
              strokeWidth={3} strokeDasharray="10 5 2 5" />
            <rect x={box.x-gap} y={box.y-gap} width={box.width+2*gap} height={box.height+2*gap}
              rx={node.type === 'association' ? 24 : 14} fill="none" stroke={other.user.avatarFg}
              strokeWidth={0.8} strokeDasharray="10 5 2 5" />
            <text x={box.x} y={box.y-gap-4} fill="var(--c-ink)" stroke="var(--c-canvas)" strokeWidth={3}
              paintOrder="stroke" fontSize={11}>{name}</text>
          </g>
        })
      })}
    </svg>
  </ViewportPortal>
}
