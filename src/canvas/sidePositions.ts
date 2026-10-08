import { Position } from '@xyflow/react'
import type { AnchorSide } from './anchors'

/**
 * Le pont entre nos côtés d'accroche et ceux de React Flow.
 *
 * Il vit à part pour que `anchors.ts` reste une géométrie pure, sans
 * dépendance à la bibliothèque de dessin, donc testable sans navigateur.
 */
export const SIDE_POSITIONS: Record<AnchorSide, Position> = {
  left: Position.Left,
  right: Position.Right,
  top: Position.Top,
  bottom: Position.Bottom,
}
