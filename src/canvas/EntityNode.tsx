import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { EntityFlowNode } from './mcdToFlow'

/**
 * Nœud entité : carte nette avec le nom en en-tête et la liste des
 * attributs, types en mono. Les attributs identifiants sont soulignés
 * et portent un badge « clé » : l'information ne repose jamais sur la
 * couleur seule.
 */
export function EntityNode({ data, selected }: NodeProps<EntityFlowNode>) {
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
      <Handle id="left" type="target" position={Position.Left} className="meriz-handle" />
      <Handle id="right" type="target" position={Position.Right} className="meriz-handle" />
      <Handle id="top" type="target" position={Position.Top} className="meriz-handle" />
      <Handle id="bottom" type="target" position={Position.Bottom} className="meriz-handle" />
    </div>
  )
}
