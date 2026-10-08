import { Handle } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { ANCHOR_SIDES } from './anchors'
import { SIDE_POSITIONS } from './sidePositions'
import type { EntityFlowNode } from './mcdToFlow'

/**
 * Nœud entité : carte nette avec le nom en en-tête et la liste des
 * attributs, types en mono. Les attributs identifiants sont soulignés
 * et portent un badge « clé » : l'information ne repose jamais sur la
 * couleur seule.
 */
export function EntityNode({ data, selected, isConnectable }: NodeProps<EntityFlowNode>) {
  const { entity, attributes } = data
  return (
    <div
      className={`min-w-44 rounded-2xl border bg-surface text-ink shadow-soft ${
        selected ? 'border-mark ring-3 ring-mark/35' : 'border-line-strong'
      }`}
    >
      <div className="rounded-t-2xl border-b border-line bg-accent-soft px-3 py-2 text-center text-sm font-semibold tracking-tight text-ink">
        {entity.name}
      </div>
      <ul className="px-3 py-2 text-xs leading-5">
        {attributes.map((attribute) => (
          <li key={attribute.propertyId} className="flex items-baseline gap-2">
            <span
              className={
                attribute.isIdentifier
                  ? 'font-medium underline decoration-accent-ink underline-offset-2'
                  : ''
              }
            >
              {attribute.name}
            </span>
            <span className="font-mono text-[11px] text-ink-soft">
              {attribute.type}
              {attribute.size !== undefined && `(${attribute.size})`}
            </span>
            {attribute.isIdentifier && (
              <span className="ml-auto self-center rounded-full bg-accent-soft px-1.5 font-mono text-[10px] font-medium text-accent-ink">
                clé
              </span>
            )}
          </li>
        ))}
      </ul>
      {/*
       * Les quatre ronds du bord sont les points d'accroche d'une patte.
       * Une patte en vise un seul, choisi à chaque image par anchors.ts,
       * donc les identifiants doivent venir de la même liste que lui.
       */}
      {ANCHOR_SIDES.map((side) => (
        <Handle
          key={side}
          id={side}
          type="target"
          position={SIDE_POSITIONS[side]}
          className="meriz-handle"
          isConnectable={isConnectable}
        />
      ))}
      {/*
       * Calque de lâcher : pendant qu'une liaison se tire, toute la surface
       * de l'entité accepte le lâcher, pour ne pas avoir à viser un rond au
       * pixel près. Il n'amorce jamais rien, donc au repos React Flow lui
       * coupe le pointeur et le corps reste la poignée de déplacement.
       */}
      <Handle
        id="bloc"
        type="target"
        position={SIDE_POSITIONS.top}
        className="meriz-drop"
        isConnectable={isConnectable}
        isConnectableStart={false}
      />
    </div>
  )
}
