import type { CollabSelectionBox } from '../model/collabProvider'

/** React Flow mesure le rectangle dans le viewport ; la présence utilise le modèle. */
export function selectionBoxInFlow(
  rectangle: CollabSelectionBox,
  [panX, panY, zoom]: readonly [number, number, number],
): CollabSelectionBox {
  return {
    x: (rectangle.x-panX)/zoom,
    y: (rectangle.y-panY)/zoom,
    width: rectangle.width/zoom,
    height: rectangle.height/zoom,
  }
}
