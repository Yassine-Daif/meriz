import type { McdEditorState } from './mcdReducer'
import type { MpdSettings } from './mpd'

/**
 * Document nommé : l'unité de travail de Meriz, comme un fichier.
 * Il réunit le contenu (MCD, positions, réglages MPD) et des
 * métadonnées. Le MCD reste la source de vérité du document.
 */

/**
 * D'où vient un document, donc ce que son libellé doit dire à l'élève.
 * Un travail de devoir est un document personnel ordinaire côté serveur :
 * seule cette provenance permet de le distinguer dans une liste.
 */
export type DocumentOrigin =
  | { kind: 'personal' }
  | { kind: 'assignment'; assignmentId: string }
  | { kind: 'group'; groupId: string }

/**
 * Provenance déduite des colonnes du serveur. Le groupe l'emporte : un
 * document partagé n'est jamais le travail d'un seul élève.
 */
export function documentOrigin(assignmentId: string | null, groupId: string | null): DocumentOrigin {
  if (groupId !== null) {
    return { kind: 'group', groupId }
  }
  return assignmentId !== null ? { kind: 'assignment', assignmentId } : { kind: 'personal' }
}

/** Métadonnées d'un document, dates au format ISO 8601. */
export interface DocumentMeta {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  /**
   * Absente quand la provenance n'est pas connue : espace local de ce
   * navigateur, ou cache écrit par une version d'avant. On ne devine pas.
   */
  origin?: DocumentOrigin
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
