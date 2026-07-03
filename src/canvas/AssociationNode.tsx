import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { AssociationFlowNode } from './mcdToFlow'



/**
 * Nœud association : ovale sobre, légèrement teinté d'accent (jamais
 * un lien). Affiche le nom et les attributs portés s'il y en a. Les
 * handles sont le point de départ du geste « relier » vers une entité.
 */
export function AssociationNode({ data, selected }: NodeProps<AssociationFlowNode>) {
  const { association, attributes } = data
  return (
    <div
      className={`rounded-full border px-6 py-2.5 text-center shadow-sm ${
        selected
          ? 'border-indigo-700 bg-indigo-50 ring-2 ring-indigo-200'
          : 'border-indigo-300 bg-indigo-50/60'
      }`}
    >
      <div className="text-sm font-semibold tracking-tight">{association.name}</div>
      {attributes.length > 0 && (
        <ul className="mt-0.5 text-xs leading-5">
          {attributes.map((attribute) => (
            <li key={attribute.propertyId}>
              {attribute.name}{' '}
              <span className="font-mono text-[11px] text-zinc-500">
                {attribute.type}
                {attribute.size !== undefined && `(${attribute.size})`}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Handle id="left" type="source" position={Position.Left} className="meriz-handle" />
      <Handle id="right" type="source" position={Position.Right} className="meriz-handle" />
      <Handle id="top" type="source" position={Position.Top} className="meriz-handle" />
      <Handle id="bottom" type="source" position={Position.Bottom} className="meriz-handle" />
    </div>
  )
}
