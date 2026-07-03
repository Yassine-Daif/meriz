import type { McdAction, McdEditorState } from './mcdReducer'
import { mcdReducer } from './mcdReducer'

/**
 * Historique annuler/rétablir autour du reducer du modèle.
 * La sélection et la vue active ne sont pas historisées : seul
 * l'état { mcd, layout } compte.
 */

const HISTORY_LIMIT = 100

export interface HistoryState {
  past: McdEditorState[]
  present: McdEditorState
  future: McdEditorState[]
  /** Signature de la dernière action, pour fusionner les actions continues. */
  lastSignature: string | null
}

export type HistoryAction = McdAction | { type: 'UNDO' } | { type: 'REDO' }

export function createHistory(present: McdEditorState): HistoryState {
  return { past: [], present, future: [], lastSignature: null }
}

/**
 * Les actions « continues » (frappe dans un champ, déplacement aux
 * flèches) fusionnent dans une même étape d'historique tant qu'elles
 * se répètent sur la même cible : un Ctrl+Z rétablit le tout.
 */
function actionSignature(action: McdAction): string | null {
  switch (action.type) {
    case 'RENAME_ENTITY':
    case 'RENAME_ASSOCIATION':
      return `${action.type}:${action.id}`
    case 'UPDATE_PROPERTY':
      return `${action.type}:${action.propertyId}`
    case 'SET_LEG_ROLE':
      return `${action.type}:${action.legId}`
    case 'MOVE_NODE':
      return `${action.type}:${action.id}`
    default:
      return null
  }
}

export function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  if (action.type === 'UNDO') {
    const previous = state.past[state.past.length - 1]
    if (!previous) {
      return state
    }
    return {
      past: state.past.slice(0, -1),
      present: previous,
      future: [state.present, ...state.future],
      lastSignature: null,
    }
  }

  if (action.type === 'REDO') {
    const next = state.future[0]
    if (!next) {
      return state
    }
    return {
      past: [...state.past, state.present],
      present: next,
      future: state.future.slice(1),
      lastSignature: null,
    }
  }

  const present = mcdReducer(state.present, action)
  // Refus silencieux du reducer (même référence) : rien à historiser.
  if (present === state.present) {
    return state
  }

  const signature = actionSignature(action)
  const coalesce = signature !== null && signature === state.lastSignature
  return {
    past: coalesce ? state.past : [...state.past, state.present].slice(-HISTORY_LIMIT),
    present,
    future: [],
    lastSignature: signature,
  }
}
