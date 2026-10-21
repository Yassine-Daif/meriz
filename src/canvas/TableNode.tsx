import { t } from "../i18n/runtime"
import { useLanguage } from "../lib/useLanguage"
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
export function TableNode({ data, selected }: NodeProps<TableFlowNode>) {
  useLanguage()
  const { table } = data
  return (
    // Même bague que dans le MCD : une table sélectionnée se signalait
    // par rien du tout, le style par défaut de React Flow ne visant que
    // ses propres types de nœuds.
    <div
      className={`min-w-48 rounded-node border bg-surface text-ink shadow-soft ${
        selected
          ? 'border-mark ring-3 ring-mark/45 ring-offset-2 ring-offset-canvas'
          : 'border-line-strong'
      }`}
    >
      <div className="rounded-t-node border-b border-line bg-accent-soft px-3 py-2 text-center text-sm font-semibold tracking-tight text-ink">
        {table.name}
      </div>
      <ul className="px-3 py-2 font-mono text-xs leading-6">
        {table.columns.map((column) => (
          <li key={column.id} className="flex items-baseline gap-3">
            <span
              className={
                column.isPrimaryKey
                  ? 'font-medium underline decoration-accent-ink underline-offset-2'
                  : column.references
                    ? 'text-accent-ink'
                    : ''
              }
            >
              {column.references && (
                <>
                  {/* Le « # » est la convention AnalyseSI. Il était masqué
                      aux lecteurs d'écran, donc une colonne étrangère ne
                      se distinguait pour eux que par sa couleur. */}
                  <span aria-hidden="true">#</span>
                  <span className="sr-only">{t("clé étrangère, ")}</span>
                </>
              )}
              {column.name}
            </span>
            <span className="ml-auto text-ink-soft">{column.sqlType}</span>
            {column.isPrimaryKey && (
              <span className="self-center rounded-full bg-accent-soft px-1.5 text-nano font-medium text-accent-ink">
                {t("PK")}</span>
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
