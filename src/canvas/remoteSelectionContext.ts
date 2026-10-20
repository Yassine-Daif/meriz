import { createContext } from 'react'
import type { RemotePresence } from '../model/collabProvider'

/** État éphémère d'affichage, jamais inscrit dans les nœuds du modèle. */
export const RemoteSelectionContext = createContext<RemotePresence[]>([])
