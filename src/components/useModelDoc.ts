import { useCallback, useState, useSyncExternalStore } from 'react'
import type { McdAction, McdEditorState } from '../model/mcdReducer'
import { createModelDoc } from '../model/modelDoc'

/**
 * Le modèle de l'éditeur, porté par un document Yjs. Le composant ne
 * voit qu'un état JS ordinaire et une fonction pour agir dessus.
 *
 * `useSyncExternalStore` est l'outil juste ici : il garantit qu'aucun
 * rendu ne lit un état en retard sur le document.
 *
 * Le document n'est pas détruit au démontage, et c'est volontaire. Sans
 * réseau ni minuteur, il n'y a aucune ressource à rendre, et une
 * destruction dans un nettoyage d'effet serait fatale : en mode strict,
 * React monte, démonte puis remonte, et le document serait détruit pour
 * de bon. L'étape du réseau fermera sa connexion dans son propre effet.
 */
export interface ModelDocHandle {
  state: McdEditorState
  dispatch: (action: McdAction) => void
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
  /** Instantané venu d'ailleurs (observation en direct). */
  adopt: (state: McdEditorState) => void
}

export function useModelDoc(initial: McdEditorState): ModelDocHandle {
  const [modelDoc] = useState(() => createModelDoc(initial))
  const state = useSyncExternalStore(modelDoc.subscribe, modelDoc.snapshot)

  const dispatch = useCallback((action: McdAction) => modelDoc.apply(action), [modelDoc])
  const undo = useCallback(() => modelDoc.undo(), [modelDoc])
  const redo = useCallback(() => modelDoc.redo(), [modelDoc])
  const adopt = useCallback((next: McdEditorState) => modelDoc.adopt(next), [modelDoc])

  return {
    state,
    dispatch,
    // Relu à chaque rendu : toute écriture qui change ces piles change
    // aussi le document, donc provoque déjà un nouveau rendu.
    canUndo: modelDoc.canUndo(),
    canRedo: modelDoc.canRedo(),
    undo,
    redo,
    adopt,
  }
}
