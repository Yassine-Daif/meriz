/**
 * Le côté par lequel une patte quitte un bloc.
 *
 * Une patte s'accroche à l'un des quatre ronds posés sur le bord. Le choix
 * se fait ici, à partir de la géométrie seule, pour qu'il soit recalculé à
 * chaque image du déplacement et qu'un test puisse le vérifier. Le modèle,
 * lui, ne connaît aucun côté d'accroche.
 */

export type AnchorSide = 'left' | 'right' | 'top' | 'bottom'

/** Les quatre identifiants de rond, déclarés une seule fois pour tout le canevas. */
export const ANCHOR_SIDES = ['left', 'right', 'top', 'bottom'] as const

export interface AnchorBox {
  x: number
  y: number
  width: number
  height: number
}

/** Un nœud tel que le canevas le voit : coin haut-gauche et taille mesurée. */
export interface MeasurableNode {
  type?: string
  position: { x: number; y: number }
  measured?: { width?: number; height?: number }
}

/*
 * Tailles de repli, le temps que la mesure arrive. Elles suivent la nature
 * du bloc pour que même la première image ait le bon rapport de forme :
 * une entité est une carte large, une association une capsule basse.
 */
const ENTITY_FALLBACK = { width: 176, height: 88 }
const ASSOCIATION_FALLBACK = { width: 152, height: 48 }

/** Une mesure absente ou nulle est un bloc pas encore posé, pas un bloc plat. */
function size(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && value > 0 ? value : fallback
}

export function anchorBox(node: MeasurableNode): AnchorBox {
  const fallback = node.type === 'association' ? ASSOCIATION_FALLBACK : ENTITY_FALLBACK
  return {
    x: node.position.x,
    y: node.position.y,
    width: size(node.measured?.width, fallback.width),
    height: size(node.measured?.height, fallback.height),
  }
}

/**
 * Le côté par lequel le segment quitte la boîte.
 *
 * On compare la pente du segment à celle de la diagonale du bloc, en
 * produits croisés plutôt qu'en divisions : aucun cas particulier si une
 * taille vaut zéro. L'axe dominant brut serait faux dès qu'un bloc n'est
 * pas carré, et le trait traverserait la carte.
 */
function exitSide(box: AnchorBox, dx: number, dy: number): AnchorSide {
  if (Math.abs(dx) * box.height >= Math.abs(dy) * box.width) {
    return dx >= 0 ? 'right' : 'left'
  }
  return dy >= 0 ? 'bottom' : 'top'
}

/**
 * Les deux ronds auxquels une patte s'accroche, au plus près l'un de
 * l'autre. Chaque bloc est jugé avec sa propre boîte, donc les deux côtés
 * ne sont pas forcément opposés : c'est ce qui évite qu'un trait parte du
 * mauvais côté d'une carte large.
 */
export function pickAnchors(
  source: AnchorBox,
  target: AnchorBox,
): { sourceHandle: AnchorSide; targetHandle: AnchorSide } {
  const dx = target.x + target.width / 2 - (source.x + source.width / 2)
  const dy = target.y + target.height / 2 - (source.y + source.height / 2)
  return {
    sourceHandle: exitSide(source, dx, dy),
    targetHandle: exitSide(target, -dx, -dy),
  }
}
