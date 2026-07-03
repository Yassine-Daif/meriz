import { getNodesBounds, getViewportForBounds } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import { toPng } from 'html-to-image'

// Plafond de dimensions pour ne pas produire un canvas démesuré.
const MAX_DIMENSION = 4096
const PADDING = 0.1

/**
 * Exporte le schéma entier en PNG (pas seulement la partie visible),
 * selon la méthode recommandée par React Flow : boîte englobante de
 * tous les nœuds → viewport ajusté à ces dimensions → capture de
 * l'élément du viewport avec html-to-image.
 */
export function exportToPng(nodes: Node[], viewportElement: HTMLElement): Promise<string> {
  const bounds = getNodesBounds(nodes)
  const scale = Math.min(1, MAX_DIMENSION / bounds.width, MAX_DIMENSION / bounds.height)
  const width = Math.max(1, Math.round(bounds.width * scale))
  const height = Math.max(1, Math.round(bounds.height * scale))
  const viewport = getViewportForBounds(bounds, width, height, 0.05, 1, PADDING)

  return toPng(viewportElement, {
    backgroundColor: '#ffffff',
    width,
    height,
    pixelRatio: 2,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
    // La grille de fond n'appartient pas au schéma : exclue de l'image.
    filter: (domNode) => !domNode.classList?.contains('react-flow__background'),
  })
}
