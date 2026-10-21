/**
 * Le trait du crayon rouge, borné.
 *
 * Il part dans la présence, qui réencode son état entier quinze fois par
 * seconde : une polyligne sans limite y pèserait vite. Trois bornes donc,
 * toutes ici, toutes testables sans navigateur : on décime les points
 * trop proches, on arrondit à l'entier, et on simplifie les gestes longs en conservant leurs extrémités.
 *
 * Ce module ne connaît ni React ni le modèle. La durée et la conservation
 * des traits sont décidées par l’outil d’annotation.
 */

export interface InkPoint {
  x: number
  y: number
}

/** Au-delà, les points sont simplifiés : la charge reste bornée. */
export const INK_MAX_POINTS = 64

/** Deux points plus proches que ça ne disent rien de plus. */
export const INK_MIN_STEP = 4

/** Arrondi à l'entier : un point ne mérite pas douze décimales. */
export function roundInkPoint(point: InkPoint): InkPoint {
  return { x: Math.round(point.x), y: Math.round(point.y) }
}

/**
 * Le point suivant d'un trait.
 *
 * Trop proche du précédent : le **même** tableau est rendu, donc rien ne
 * change et rien ne repart sur le réseau. C'est volontaire, et c'est ce
 * qui rend un geste lent presque gratuit.
 */
export function appendInkPoint(points: InkPoint[], point: InkPoint): InkPoint[] {
  const rounded = roundInkPoint(point)
  const last = points[points.length - 1]
  if (last !== undefined) {
    const dx = rounded.x - last.x
    const dy = rounded.y - last.y
    if (Math.hypot(dx, dy) < INK_MIN_STEP) {
      return points
    }
  }
  const next = [...points, rounded]
  return next.length > INK_MAX_POINTS ? next.filter((_, index) => index % 2 === 0 || index === next.length - 1) : next
}
