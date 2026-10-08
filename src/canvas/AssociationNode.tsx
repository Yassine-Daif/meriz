import { Handle } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { ANCHOR_SIDES } from './anchors'
import { SIDE_POSITIONS } from './sidePositions'
import type { AssociationFlowNode } from './mcdToFlow'

/**
 * Nœud association : ovale sobre, légèrement teinté d'accent (jamais
 * un lien). Affiche le nom et les attributs portés s'il y en a. Ses
 * quatre ronds amorcent le geste « relier » vers une entité.
 */
export function AssociationNode({ data, selected, isConnectable }: NodeProps<AssociationFlowNode>) {
  const { association, attributes } = data
  return (
    <div
      className={`rounded-full border px-6 py-2.5 text-center text-ink shadow-soft ${
        selected
          ? 'border-mark bg-accent-soft ring-3 ring-mark/35'
          : 'border-line-strong bg-accent-soft'
      }`}
    >
      <div className="text-sm font-semibold tracking-tight">{association.name}</div>
      {attributes.length > 0 && (
        <ul className="mt-0.5 text-xs leading-5">
          {attributes.map((attribute) => (
            <li key={attribute.propertyId}>
              {attribute.name}{' '}
              <span className="font-mono text-[11px] text-ink-soft">
                {attribute.type}
                {attribute.size !== undefined && `(${attribute.size})`}
              </span>
            </li>
          ))}
        </ul>
      )}
      {/* Les quatre ronds du bord, points de départ d'une patte. */}
      {ANCHOR_SIDES.map((side) => (
        <Handle
          key={side}
          id={side}
          type="source"
          position={SIDE_POSITIONS[side]}
          className="meriz-handle"
          isConnectable={isConnectable}
        />
      ))}
    </div>
  )
}
