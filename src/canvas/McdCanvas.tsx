import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  ReactFlow,
  SelectionMode,
  useReactFlow,
  useStoreApi,
} from '@xyflow/react'
import type {
  Connection,
  EdgeChange,
  IsValidConnection,
  NodeChange,
  OnConnectEnd,
  OnConnectStart,
  OnNodeDrag,
} from '@xyflow/react'
import { anchorBox, pickAnchors } from './anchors'
import { mcdToFlow } from './mcdToFlow'
import type { LegFlowEdge, McdFlowNode } from './mcdToFlow'
import { EntityNode } from './EntityNode'
import { AssociationNode } from './AssociationNode'
import { LegEdge } from './LegEdge'
import type { McdAction, McdEditorState } from '../model/mcdReducer'
import { canCreateLeg } from '../model/queries'
import type { CanvasSelection } from './selection'
import { McdDispatchContext } from './dispatchContext'
import { useGestureStream } from './gestureStream'
import { RemoteCursors } from './RemoteCursors'
import { RemoteDraftLinks } from './RemoteDraftLinks'
import type { RemotePresence } from '../model/collabProvider'
import { useTheme } from '../lib/useTheme'

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
  /** Curseurs des autres participants, en co-édition. */
  others?: RemotePresence[]
  /** Ma position de pointeur, pour que les autres me voient. */
  onPointerFlow?: (position: { x: number; y: number } | null) => void
  /**
   * La liaison que je tire, pour que les autres la voient se dessiner.
   * Null au lâcher. Ce tracé ne passe jamais par le modèle.
   */
  onDraftLink?: (from: { x: number; y: number } | null) => void
  /** Faux entre pairs d'un groupe : aucune étiquette prof sur les curseurs. */
  teacherTag?: boolean
  /**
   * Consultation seule : on parcourt, on zoome, on sélectionne pour lire,
   * mais rien ne se déplace, ne se relie ni ne se supprime.
   */
  readOnly?: boolean
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
  others,
  onPointerFlow,
  onDraftLink,
  teacherTag = true,
  readOnly = false,
}: McdCanvasProps) {
  const theme = useTheme()
  const { screenToFlowPosition } = useReactFlow()
  const store = useStoreApi<McdFlowNode, LegFlowEdge>()
  // Un geste de souris se diffuse pendant qu'il se fait, et ne compte
  // que pour une seule étape d'annulation.
  const gesture = useGestureStream(dispatch)
  const paneRef = useRef<HTMLElement | null>(null)

  /*
   * Position du pointeur, pour que les autres voient où l'on est. On
   * écoute en phase de capture, sur l'élément : React Flow arrête la
   * propagation de ces évènements, donc un gestionnaire React posé plus
   * haut ne les verrait jamais passer.
   */
  useEffect(() => {
    const pane = paneRef.current
    if (!onPointerFlow || pane === null) {
      return
    }
    const onMove = (event: PointerEvent) => {
      onPointerFlow(screenToFlowPosition({ x: event.clientX, y: event.clientY }))
    }
    const onLeave = () => onPointerFlow(null)
    pane.addEventListener('pointermove', onMove, true)
    pane.addEventListener('pointerleave', onLeave, true)
    return () => {
      pane.removeEventListener('pointermove', onMove, true)
      pane.removeEventListener('pointerleave', onLeave, true)
    }
  }, [onPointerFlow, screenToFlowPosition])
  const [nodes, setNodes] = useState<McdFlowNode[]>([])
  const [edges, setEdges] = useState<LegFlowEdge[]>([])

  /*
   * Resynchronise la vue depuis le modèle. Un nœud en cours de glisser
   * garde sa position locale, plus fraîche que le layout.
   *
   * La mesure d'un nœud se conserve d'un relevé à l'autre : les objets
   * sont neufs à chaque fois, et un nœud qui perdrait sa taille au
   * milieu d'un glisser ne serait plus déplaçable pour React Flow.
   */
  useEffect(() => {
    const derived = mcdToFlow(state.mcd, state.layout)
    setNodes((current) => {
      const byId = new Map(current.map((node) => [node.id, node]))
      return derived.nodes.map((node) => {
        const existing = byId.get(node.id)
        const measured = existing?.measured ? { measured: existing.measured } : {}
        if (existing?.dragging) {
          return {
            ...node,
            ...measured,
            position: existing.position,
            dragging: true,
            selected: existing.selected,
          }
        }
        return { ...node, ...measured, selected: selection.nodeIds.has(node.id) }
      })
    })
    setEdges(derived.edges.map((edge) => ({ ...edge, selected: selection.edgeIds.has(edge.id) })))
  }, [state.mcd, state.layout, selection])

  /*
   * Le côté d'accroche de chaque patte, recalculé à chaque image depuis les
   * positions vivantes et les tailles mesurées. Le modèle, lui, n'est écrit
   * qu'à la cadence du geste : s'y fier ferait courir le trait après son
   * bloc. Même idée que la vue MPD, qui dérive ses liens de ses nœuds.
   *
   * On ne touche jamais à l'état `edges` : il reste le seul propriétaire de
   * la sélection. Et quand aucun côté ne change, on rend le tableau reçu,
   * donc React Flow ne réconcilie pas les liens pour rien.
   */
  const anchoredEdges = useMemo(() => {
    const boxes = new Map(nodes.map((node) => [node.id, anchorBox(node)]))
    const next = edges.map((edge) => {
      const source = boxes.get(edge.source)
      const target = boxes.get(edge.target)
      if (!source || !target) {
        // Sans boîte, aucun identifiant : React Flow prend le premier rond,
        // plutôt que de chercher un côté qui n'existerait pas.
        return edge
      }
      const anchors = pickAnchors(source, target)
      return edge.sourceHandle === anchors.sourceHandle && edge.targetHandle === anchors.targetHandle
        ? edge
        : { ...edge, ...anchors }
    })
    return next.every((edge, index) => edge === edges[index]) ? edges : next
  }, [edges, nodes])

  const onNodesChange = useCallback(
    (changes: NodeChange<McdFlowNode>[]) => {
      setNodes((current) => applyNodeChanges(changes, current))
      for (const change of changes) {
        if (change.type === 'position' && change.position && change.dragging !== true) {
          /*
           * Deux cas arrivent ici. Les flèches du clavier, sans geste en
           * cours : position finale immédiate, fondue par cible comme
           * avant. Et la fin d'un glisser de souris, que React Flow
           * écrit juste avant d'appeler onNodeDragStop : le jeton la
           * rattache alors au geste, donc un glisser groupé reste une
           * seule étape d'annulation.
           */
          dispatch({
            type: 'MOVE_NODE',
            id: change.id,
            position: change.position,
            gesture: gesture.token() ?? undefined,
          })
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
    [dispatch, gesture, onSelectionChange],
  )

  const onNodeDragStart = useCallback<OnNodeDrag<McdFlowNode>>(() => {
    gesture.begin()
  }, [gesture])

  /*
   * Pendant le glisser, les positions intermédiaires partent à cadence
   * tenue : l'autre participant voit le mouvement, au lieu d'attendre
   * le lâcher. Celui qui glisse garde sa fluidité, parce que l'effet de
   * resynchronisation préserve la position locale d'un nœud en cours de
   * glisser.
   */
  const onNodeDrag = useCallback<OnNodeDrag<McdFlowNode>>(
    (_event, _node, draggedNodes) => {
      gesture.push({
        type: 'MOVE_NODES',
        moves: draggedNodes.map((dragged) => ({ id: dragged.id, position: dragged.position })),
        gesture: gesture.token() ?? gesture.begin(),
      })
    },
    [gesture],
  )

  // Lâcher : les positions exactes, et le geste se referme. L'attente
  // est jetée, sinon une image en retard reposerait le nœud à côté.
  const onNodeDragStop = useCallback<OnNodeDrag<McdFlowNode>>(
    (_event, _node, draggedNodes) => {
      gesture.commit({
        type: 'MOVE_NODES',
        moves: draggedNodes.map((dragged) => ({ id: dragged.id, position: dragged.position })),
        gesture: gesture.token() ?? undefined,
      })
    },
    [gesture],
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

  /*
   * Le sens est imposé : une patte va d'une association vers une entité.
   * La forme des ronds le dit déjà, `source` d'un côté et `target` de
   * l'autre, mais c'est la règle du modèle qui le prouve, et c'est elle qui
   * est couverte par un test.
   */
  const isValidConnection = useCallback<IsValidConnection<LegFlowEdge>>(
    (connection) => canCreateLeg(state.mcd, connection.source, connection.target),
    [state.mcd],
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!canCreateLeg(state.mcd, connection.source, connection.target)) {
        return
      }
      dispatch({ type: 'ADD_LEG', associationId: connection.source, entityId: connection.target })
    },
    [dispatch, state.mcd],
  )

  /*
   * Un tracé en cours ne passe jamais par le modèle : il part dans la
   * présence, comme un curseur, et disparaît au lâcher. L'ancrage se lit
   * dans le store, donc le trait des autres part exactement d'où part le
   * mien.
   */
  const onConnectStart = useCallback<OnConnectStart>(() => {
    const { connection } = store.getState()
    onDraftLink?.(connection.inProgress ? { x: connection.from.x, y: connection.from.y } : null)
  }, [store, onDraftLink])

  const onConnectEnd = useCallback<OnConnectEnd>(() => {
    onDraftLink?.(null)
  }, [onDraftLink])

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
    <section ref={paneRef} aria-label="Zone de dessin du MCD" className="min-h-0 min-w-0 flex-1 bg-canvas">
      <McdDispatchContext.Provider value={dispatch}>
      <ReactFlow<McdFlowNode, LegFlowEdge>
        nodes={nodes}
        edges={anchoredEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onConnect={readOnly ? undefined : onConnect}
        onConnectStart={readOnly ? undefined : onConnectStart}
        onConnectEnd={readOnly ? undefined : onConnectEnd}
        isValidConnection={isValidConnection}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onBeforeDelete={onBeforeDelete}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        deleteKeyCode={isActive && !readOnly ? ['Backspace', 'Delete'] : null}
        edgesFocusable
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        // Sélection multiple : glisser gauche = zone de sélection
        // (toucher un élément suffit), Shift/Ctrl+clic = ajout.
        // Le déplacement de la vue passe au bouton du milieu ou droit,
        // et à la molette.
        connectionLineStyle={{ stroke: 'var(--c-mark)', strokeWidth: 1.5 }}
        colorMode={theme.resolved}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        multiSelectionKeyCode={['Shift', 'Control', 'Meta']}
        panOnDrag={[1, 2]}
        panOnScroll
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} />
        {others && others.length > 0 && <RemoteDraftLinks others={others} />}
        {others && others.length > 0 && <RemoteCursors others={others} teacherTag={teacherTag} />}
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
