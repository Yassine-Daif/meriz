import type { Edge, Node } from '@xyflow/react'
import type { Association, Cardinality, Entity, Mcd } from '../model/mcd'
import type { McdLayout } from '../model/layout'
import { resolveAttributes } from '../model/queries'
import type { ResolvedAttribute } from '../model/queries'

/**
 * Types React Flow dérivés du modèle. Le `data` des nœuds est une vue
 * calculée à chaque rendu (références résolues vers le dictionnaire) :
 * la source de vérité reste le Mcd.
 */
export type EntityFlowNode = Node<
  { entity: Entity; attributes: ResolvedAttribute[] },
  'entity'
>
export type AssociationFlowNode = Node<
  { association: Association; attributes: ResolvedAttribute[] },
  'association'
>
export type McdFlowNode = EntityFlowNode | AssociationFlowNode
export type LegFlowEdge = Edge<
  {
    cardinality: Cardinality
    role?: string
    /** Position choisie de l'étiquette (layout), sinon défaut sur la ligne. */
    labelPosition?: { x: number; y: number }
  },
  'leg'
>

const FALLBACK_POSITION = { x: 0, y: 0 }

/**
 * Choisit les côtés d'accroche d'une patte selon l'axe dominant entre
 * les deux nœuds : gauche/droite si l'écart horizontal domine, sinon
 * haut/bas. Les liaisons se répartissent sur les quatre côtés et se
 * chevauchent moins quand le schéma se densifie.
 */
function pickSides(
  source: { x: number; y: number },
  target: { x: number; y: number },
): { sourceHandle: string; targetHandle: string } {
  const dx = target.x - source.x
  const dy = target.y - source.y
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourceHandle: 'right', targetHandle: 'left' }
      : { sourceHandle: 'left', targetHandle: 'right' }
  }
  return dy >= 0
    ? { sourceHandle: 'bottom', targetHandle: 'top' }
    : { sourceHandle: 'top', targetHandle: 'bottom' }
}

/**
 * Transformation pure : Mcd + McdLayout → nœuds et liens React Flow.
 * Une entité et une association sont des nœuds, une patte est un lien.
 * Le côté des handles (gauche/droite) est choisi selon les positions
 * relatives, pour que la patte ne traverse pas son association.
 */
export function mcdToFlow(
  mcd: Mcd,
  layout: McdLayout,
): { nodes: McdFlowNode[]; edges: LegFlowEdge[] } {
  const nodes: McdFlowNode[] = [
    ...mcd.entities.map(
      (entity): EntityFlowNode => ({
        id: entity.id,
        type: 'entity',
        position: layout[entity.id] ?? FALLBACK_POSITION,
        data: { entity, attributes: resolveAttributes(mcd, entity.attributes) },
        ariaLabel: `Entité ${entity.name}`,
      }),
    ),
    ...mcd.associations.map(
      (association): AssociationFlowNode => ({
        id: association.id,
        type: 'association',
        position: layout[association.id] ?? FALLBACK_POSITION,
        data: { association, attributes: resolveAttributes(mcd, association.attributes) },
        ariaLabel: `Association ${association.name}`,
      }),
    ),
  ]

  const edges: LegFlowEdge[] = mcd.associations.flatMap((association) => {
    const associationPosition = layout[association.id] ?? FALLBACK_POSITION
    return association.legs.map((leg): LegFlowEdge => {
      const entityPosition = layout[leg.entityId] ?? FALLBACK_POSITION
      const sides = pickSides(associationPosition, entityPosition)
      const entityName = mcd.entities.find((e) => e.id === leg.entityId)?.name ?? leg.entityId
      return {
        id: leg.id,
        type: 'leg',
        source: association.id,
        sourceHandle: sides.sourceHandle,
        target: leg.entityId,
        targetHandle: sides.targetHandle,
        data: { cardinality: leg.cardinality, role: leg.role, labelPosition: layout[leg.id] },
        ariaLabel: `Patte de ${association.name} vers ${entityName}, cardinalité ${leg.cardinality.min},${leg.cardinality.max}`,
      }
    })
  })

  return { nodes, edges }
}
