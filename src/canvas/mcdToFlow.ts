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
 * Transformation pure : Mcd + McdLayout → nœuds et liens React Flow.
 * Une entité et une association sont des nœuds, une patte est un lien.
 *
 * Aucun côté d'accroche n'est posé ici : il dépend des tailles mesurées et
 * des positions vivantes, donc il se choisit dans le canevas, à chaque
 * image, par `anchors.ts`. Le modèle n'a pas à connaître la géométrie.
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

  const edges: LegFlowEdge[] = mcd.associations.flatMap((association) =>
    association.legs.map((leg): LegFlowEdge => {
      const entityName = mcd.entities.find((e) => e.id === leg.entityId)?.name ?? leg.entityId
      return {
        id: leg.id,
        type: 'leg',
        source: association.id,
        target: leg.entityId,
        data: { cardinality: leg.cardinality, role: leg.role, labelPosition: layout[leg.id] },
        ariaLabel: `Patte de ${association.name} vers ${entityName}, cardinalité ${leg.cardinality.min},${leg.cardinality.max}`,
      }
    }),
  )

  return { nodes, edges }
}
