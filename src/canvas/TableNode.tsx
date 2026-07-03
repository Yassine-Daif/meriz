import { Handle, Position } from '@xyflow/react'
import type { Node, NodeProps } from '@xyflow/react'
import type { MpdTable } from '../model/mpd'

export type TableFlowNode = Node<{ table: MpdTable }, 'table'>

// Handles invisibles : les flèches FK s'y accrochent, l'utilisateur
// ne crée pas de lien dans cette vue.
const handleStyle = { opacity: 0, width: 6, height: 6, pointerEvents: 'none' as const }

/**
 * Nœud d'une table physique (vue MPD) : colonnes typées SQL en mono
 * (dialecte et surcharges du mappage appliqués), clé primaire
 * soulignée + badge, clés étrangères préfixées « # » comme dans la
 * convention AnalyseSI.
 */
export function TableNode({ data }: NodeProps<TableFlowNode>) {
  const { table } = data
  return (
    <div className="min-w-48 rounded-lg border border-zinc-300 bg-surface shadow-sm">
      <div className="rounded-t-lg border-b border-line bg-shell px-3 py-1.5 text-center text-sm font-semibold tracking-tight">
        {table.name}
      </div>
      <ul className="px-3 py-2 font-mono text-xs leading-6">
        {table.columns.map((column) => (
          <li key={column.id} className="flex items-baseline gap-3">
            <span
              className={
                column.isPrimaryKey
                  ? 'font-medium underline decoration-indigo-700 underline-offset-2'
                  : column.references
                    ? 'text-indigo-700'
                    : ''
              }
            >
              {column.references && <span aria-hidden="true">#</span>}
              {column.name}
            </span>
            <span className="ml-auto text-zinc-500">{column.sqlType}</span>
            {column.isPrimaryKey && (
              <span className="self-center rounded-sm border border-indigo-200 bg-indigo-50 px-1 text-[10px] font-medium text-indigo-700">
                PK
              </span>
            )}
          </li>
        ))}
      </ul>
      <Handle id="target-left" type="target" position={Position.Left} style={handleStyle} />
      <Handle id="target-right" type="target" position={Position.Right} style={handleStyle} />
      <Handle id="target-top" type="target" position={Position.Top} style={handleStyle} />
      <Handle id="target-bottom" type="target" position={Position.Bottom} style={handleStyle} />
      <Handle id="source-left" type="source" position={Position.Left} style={handleStyle} />
      <Handle id="source-right" type="source" position={Position.Right} style={handleStyle} />
      <Handle id="source-top" type="source" position={Position.Top} style={handleStyle} />
      <Handle id="source-bottom" type="source" position={Position.Bottom} style={handleStyle} />
    </div>
  )
}
