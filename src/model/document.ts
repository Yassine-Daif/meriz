import type { McdEditorState } from './mcdReducer'
import type { MpdSettings } from './mpd'

/**
 * Document nommé : l'unité de travail de Meriz, comme un fichier.
 * Il réunit le contenu (MCD, positions, réglages MPD) et des
 * métadonnées. Le MCD reste la source de vérité du document.
 */

/** Métadonnées d'un document, dates au format ISO 8601. */
export interface DocumentMeta {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

/** Document chargé, prêt pour l'éditeur. */
export interface OpenedDocument {
  meta: DocumentMeta
  state: McdEditorState
  mpdSettings: MpdSettings
}

/** Contenu d'un document neuf : un MCD vide. */
export function emptyEditorState(): McdEditorState {
  return { mcd: { properties: [], entities: [], associations: [] }, layout: {} }
}
