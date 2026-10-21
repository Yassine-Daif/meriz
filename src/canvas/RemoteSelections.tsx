import { t } from "../i18n/runtime"
import { useLanguage } from "../lib/useLanguage"
import { ViewportPortal } from '@xyflow/react'
import { anchorBox } from './anchors'
import type { McdFlowNode } from './mcdToFlow'
import type { RemotePresence } from '../model/collabProvider'
import { displayName } from '../lib/authApi'

/** Cadres statiques : aucun mouvement, y compris en mouvement réduit. */
export function RemoteSelections({ others, nodes }: { others: RemotePresence[]; nodes: McdFlowNode[] }) {
  useLanguage()
  return <ViewportPortal>
    <svg aria-label={t("Sélections des participants")} className="pointer-events-none absolute overflow-visible"
      style={{ left: 0, top: 0, width: 1, height: 1, zIndex: 998 }}>
      {others.map((other) => {
        const box = other.selectionBox
        if (!box) return null
        const name = displayName(other.user) || t("Participant")
        return <g key={'box:'+other.clientId} data-remote-selection-box={other.clientId}
          data-participant={other.user.id} role="img" aria-label={t("Zone de sélection de ")+name}>
          <title>{t("Zone de sélection de ")+name}</title>
          <rect {...box} rx={10} fill={other.user.avatarBg} fillOpacity={0.08}
            stroke={other.user.avatarFg} strokeWidth={3} vectorEffect="non-scaling-stroke" />
          <rect {...box} rx={10} fill="none" stroke={other.user.avatarBg}
            strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          <text x={box.x} y={box.y-6} fill="var(--c-ink)" stroke="var(--c-canvas)"
            strokeWidth={3} paintOrder="stroke" fontSize={11}>{name}</text>
        </g>
      })}
      {nodes.flatMap((node) => {
        const box = anchorBox(node)
        return others.filter((other) => other.selection.includes(node.id)).map((other, index) => {
          const gap = 6 + index * 5
          const name = displayName(other.user) || t("Participant")
          return <g key={node.id+':'+other.clientId} data-remote-selection={node.id} data-participant={other.user.id}
            role="img" aria-label={t("Sélection de ")+name}>
            <title>{t("Sélection de ")+name}</title>
            <rect x={box.x-gap} y={box.y-gap} width={box.width+2*gap} height={box.height+2*gap}
              rx={node.type === t("association") ? 24 : 14} fill="none" stroke={other.user.avatarBg}
              strokeWidth={3} />
            <rect x={box.x-gap} y={box.y-gap} width={box.width+2*gap} height={box.height+2*gap}
              rx={node.type === t("association") ? 24 : 14} fill="none" stroke={other.user.avatarFg}
              strokeWidth={0.8} />
            <text x={box.x} y={box.y-gap-4} fill="var(--c-ink)" stroke="var(--c-canvas)" strokeWidth={3}
              paintOrder="stroke" fontSize={11}>{name}</text>
          </g>
        })
      })}
    </svg>
  </ViewportPortal>
}
