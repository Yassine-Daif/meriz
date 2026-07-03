/**
 * Layout du MCD : positions de dessin, séparées du modèle logique.
 *
 * Le modèle (`mcd.ts`) ne connaît aucune coordonnée. Le layout est
 * une structure à part, indexée par identifiant d'entité ou
 * d'association, pour que le modèle reste indépendant de React Flow.
 */

/** Position d'un nœud sur le canvas. */
export interface Position {
  x: number
  y: number
}

/** Positions indexées par `Entity.id` ou `Association.id`. */
export type McdLayout = Record<string, Position>
