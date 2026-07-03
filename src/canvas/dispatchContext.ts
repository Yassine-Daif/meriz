import { createContext } from 'react'
import type { Dispatch } from 'react'
import type { McdAction } from '../model/mcdReducer'

/**
 * Donne accès au dispatch du modèle depuis les composants rendus par
 * React Flow (comme l'étiquette déplaçable d'une patte), sans passer
 * de fonction dans les données des edges.
 */
export const McdDispatchContext = createContext<Dispatch<McdAction> | null>(null)
