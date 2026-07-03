/**
 * Sélection courante du canvas. État d'interface (pas du modèle),
 * porté par App pour que l'inspecteur et le panneau de validation
 * puissent le lire et le modifier.
 */
export interface CanvasSelection {
  nodeIds: ReadonlySet<string>
  edgeIds: ReadonlySet<string>
}

export const EMPTY_SELECTION: CanvasSelection = { nodeIds: new Set(), edgeIds: new Set() }
