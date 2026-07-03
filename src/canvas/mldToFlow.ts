import { MarkerType } from '@xyflow/react'
import type { Edge } from '@xyflow/react'
import type { MpdTable } from '../model/mpd'
import type { TableFlowNode } from './TableNode'

/**
 * Dérivation du diagramme MPD : les tables du MLD deviennent des
 * nœuds, chaque clé étrangère une flèche vers la table référencée.
 * Les positions sont un état de vue local (non persisté).
 */

/** Disposition initiale en grille, trois tables par rangée. */
export function initialTableNodes(tables: MpdTable[]): TableFlowNode[] {
  return tables.map((table, index) => ({
    id: table.id,
    type: 'table',
    position: { x: (index % 3) * 340, y: Math.floor(index / 3) * 280 },
    data: { table },
    ariaLabel: `Table ${table.name}`,
  }))
}

/**
 * Une flèche par clé étrangère (groupe = une patte d'origine),
 * orientée vers la table référencée. Le côté d'accroche suit les
 * positions courantes des nœuds.
 */
export function buildFkEdges(tables: MpdTable[], nodes: TableFlowNode[]): Edge[] {
  const positions = new Map(nodes.map((node) => [node.id, node.position]))
  const edges: Edge[] = []
  const seenGroups = new Set<string>()

  for (const table of tables) {
    for (const column of table.columns) {
      const ref = column.references
      if (!ref || seenGroups.has(ref.group)) {
        continue
      }
      seenGroups.add(ref.group)
      const sourcePosition = positions.get(table.id) ?? { x: 0, y: 0 }
      const targetPosition = positions.get(ref.tableId) ?? { x: 0, y: 0 }
      // Côté d'accroche selon l'axe dominant : les flèches se
      // répartissent sur les quatre côtés des tables.
      const dx = targetPosition.x - sourcePosition.x
      const dy = targetPosition.y - sourcePosition.y
      const horizontal = Math.abs(dx) >= Math.abs(dy)
      const sourceHandle = horizontal
        ? dx >= 0
          ? 'source-right'
          : 'source-left'
        : dy >= 0
          ? 'source-bottom'
          : 'source-top'
      const targetHandle = horizontal
        ? dx >= 0
          ? 'target-left'
          : 'target-right'
        : dy >= 0
          ? 'target-top'
          : 'target-bottom'
      edges.push({
        id: `fk-${ref.group}`,
        source: table.id,
        sourceHandle,
        target: ref.tableId,
        targetHandle,
        style: { stroke: '#4338ca', strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#4338ca', width: 18, height: 18 },
        ariaLabel: `Clé étrangère de ${table.name} vers ${ref.tableName}`,
      })
    }
  }

  return edges
}
