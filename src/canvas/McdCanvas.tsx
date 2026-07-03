import { useCallback, useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  ReactFlow,
  SelectionMode,
} from '@xyflow/react'
import type { Connection, EdgeChange, NodeChange, OnNodeDrag } from '@xyflow/react'
import { mcdToFlow } from './mcdToFlow'
import type { LegFlowEdge, McdFlowNode } from './mcdToFlow'
import { EntityNode } from './EntityNode'
import { AssociationNode } from './AssociationNode'
import { LegEdge } from './LegEdge'
import type { McdAction, McdEditorState } from '../model/mcdReducer'
import type { CanvasSelection } from './selection'
import { McdDispatchContext } from './dispatchContext'

// Déclarés hors composant pour garder des références stables.
const nodeTypes = { entity: EntityNode, association: AssociationNode }
const edgeTypes = { leg: LegEdge }

interface McdCanvasProps {
  state: McdEditorState
  dispatch: Dispatch<McdAction>
  selection: CanvasSelection
  onSelectionChange: Dispatch<SetStateAction<CanvasSelection>>
  /** Vue MCD affichée ou non : masquée, ses raccourcis Suppr sont coupés. */
  isActive: boolean
}

/**
 * Zone de dessin du MCD. Le modèle + layout reste la source de vérité,
 * mais les nœuds et liens passent par un état local de vue : pendant un
 * glisser, React Flow met à jour cet état image par image (fluide, sans
 * clignotement), et la position n'est validée dans le layout qu'en fin
 * de geste. Toute autre interaction dispatche une action du reducer,
 * puis l'effet de resynchronisation redérive la vue depuis le modèle.
 */
export function McdCanvas({
  state,
  dispatch,
  selection,
  onSelectionChange,
  isActive,
}: McdCanvasProps) {
  const [nodes, setNodes] = useState<McdFlowNode[]>([])
  const [edges, setEdges] = useState<LegFlowEdge[]>([])

  // Resynchronise la vue depuis le modèle. Un nœud en cours de glisser
  // garde sa position locale, plus fraîche que le layout.
  useEffect(() => {
    const derived = mcdToFlow(state.mcd, state.layout)
    setNodes((current) => {
      const byId = new Map(current.map((node) => [node.id, node]))
      return derived.nodes.map((node) => {
        const existing = byId.get(node.id)
        if (existing?.dragging) {
          return { ...node, position: existing.position, dragging: true, selected: existing.selected }
        }
        return { ...node, selected: selection.nodeIds.has(node.id) }
      })
    })
    setEdges(derived.edges.map((edge) => ({ ...edge, selected: selection.edgeIds.has(edge.id) })))
  }, [state.mcd, state.layout, selection])

  const onNodesChange = useCallback(
    (changes: NodeChange<McdFlowNode>[]) => {
      setNodes((current) => applyNodeChanges(changes, current))
      for (const change of changes) {
        if (change.type === 'position' && change.position && change.dragging !== true) {
          // Déplacement clavier (flèches) : position finale immédiate.
          dispatch({ type: 'MOVE_NODE', id: change.id, position: change.position })
        } else if (change.type === 'select') {
          onSelectionChange((previous) => {
            const nodeIds = new Set(previous.nodeIds)
            if (change.selected) {
              nodeIds.add(change.id)
            } else {
              nodeIds.delete(change.id)
            }
            return { ...previous, nodeIds }
          })
        }
      }
    },
    [dispatch, onSelectionChange],
  )

  // Fin de glisser souris : les positions sont validées dans le layout
  // en une seule action (une seule étape d'undo, même en glisser groupé).
  const onNodeDragStop = useCallback<OnNodeDrag<McdFlowNode>>(
    (_event, _node, draggedNodes) => {
      dispatch({
        type: 'MOVE_NODES',
        moves: draggedNodes.map((dragged) => ({ id: dragged.id, position: dragged.position })),
      })
    },
    [dispatch],
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange<LegFlowEdge>[]) => {
      setEdges((current) => applyEdgeChanges(changes, current))
      for (const change of changes) {
        if (change.type === 'select') {
          onSelectionChange((previous) => {
            const edgeIds = new Set(previous.edgeIds)
            if (change.selected) {
              edgeIds.add(change.id)
            } else {
              edgeIds.delete(change.id)
            }
            return { ...previous, edgeIds }
          })
        }
      }
    },
    [onSelectionChange],
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      // Seules les associations portent des handles sources : la
      // source est toujours une association, la cible une entité.
      dispatch({ type: 'ADD_LEG', associationId: connection.source, entityId: connection.target })
    },
    [dispatch],
  )

  const onNodesDelete = useCallback(
    (deleted: McdFlowNode[]) => {
      for (const node of deleted) {
        dispatch(
          node.type === 'entity'
            ? { type: 'DELETE_ENTITY', id: node.id }
            : { type: 'DELETE_ASSOCIATION', id: node.id },
        )
      }
      // React Flow n'émet pas de désélection pour un nœud supprimé :
      // on purge la sélection pour ne pas garder d'ids morts.
      onSelectionChange((previous) => {
        const nodeIds = new Set(previous.nodeIds)
        for (const node of deleted) {
          nodeIds.delete(node.id)
        }
        return { ...previous, nodeIds }
      })
    },
    [dispatch, onSelectionChange],
  )

  // Suppression groupée : au-delà de deux éléments d'un coup, une
  // confirmation modale. L'erreur reste annulable avec Ctrl+Z.
  // React Flow attend la résolution de la promesse pendant que la
  // boîte est ouverte.
  const [pendingDelete, setPendingDelete] = useState<{
    count: number
    resolve: (confirmed: boolean) => void
  } | null>(null)

  const onBeforeDelete = useCallback(
    ({ nodes, edges }: { nodes: McdFlowNode[]; edges: LegFlowEdge[] }) => {
      const count = nodes.length + edges.length
      if (count <= 2) {
        return Promise.resolve(true)
      }
      return new Promise<boolean>((resolve) => {
        setPendingDelete({ count, resolve })
      })
    },
    [],
  )

  const closePendingDelete = useCallback(
    (confirmed: boolean) => {
      pendingDelete?.resolve(confirmed)
      setPendingDelete(null)
    },
    [pendingDelete],
  )

  const onEdgesDelete = useCallback(
    (deleted: LegFlowEdge[]) => {
      for (const edge of deleted) {
        dispatch({ type: 'DELETE_LEG', id: edge.id })
      }
      onSelectionChange((previous) => {
        const edgeIds = new Set(previous.edgeIds)
        for (const edge of deleted) {
          edgeIds.delete(edge.id)
        }
        return { ...previous, edgeIds }
      })
    },
    [dispatch, onSelectionChange],
  )

  return (
    <section aria-label="Zone de dessin du MCD" className="min-h-0 min-w-0 flex-1 bg-canvas">
      <McdDispatchContext.Provider value={dispatch}>
      <ReactFlow<McdFlowNode, LegFlowEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onBeforeDelete={onBeforeDelete}
        deleteKeyCode={isActive ? ['Backspace', 'Delete'] : null}
        edgesFocusable
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        // Sélection multiple : glisser gauche = zone de sélection
        // (toucher un élément suffit), Shift/Ctrl+clic = ajout.
        // Le déplacement de la vue passe au bouton du milieu ou droit,
        // et à la molette.
        connectionLineStyle={{ stroke: '#4338ca', strokeWidth: 1.5 }}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        multiSelectionKeyCode={['Shift', 'Control', 'Meta']}
        panOnDrag={[1, 2]}
        panOnScroll
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} />
      </ReactFlow>
      </McdDispatchContext.Provider>
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Suppression groupée"
        message={`Supprimer ${pendingDelete?.count ?? 0} éléments d'un coup ? Vous pourrez annuler avec Ctrl+Z.`}
        confirmLabel="Oui, supprimer"
        onConfirm={() => closePendingDelete(true)}
        onCancel={() => closePendingDelete(false)}
      />
    </section>
  )
}
