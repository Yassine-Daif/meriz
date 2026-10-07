import type { DocumentMeta } from '../model/document'
import type { AssignmentIndex } from '../lib/workAssignments'
import type { BadgeTone } from './ui/Badge'

/**
 * La provenance d'un document, telle qu'une liste l'affiche. Un seul
 * endroit décide du couple libellé et ton, pour que deux écrans ne
 * racontent jamais deux choses différentes du même document.
 *
 * Le texte porte toujours le sens : la couleur n'est qu'un repère en plus.
 */
export interface Provenance {
  /** Texte de la pastille, court. */
  label: string
  tone: BadgeTone
  /** Complément lu par un lecteur d'écran, avec le nom du devoir s'il est connu. */
  spoken: string
}

export const PERSONAL_PROVENANCE: Provenance = { label: 'Perso', tone: 'apricot', spoken: 'Perso' }
export const GROUP_PROVENANCE: Provenance = { label: 'Groupe', tone: 'sky', spoken: 'Groupe' }

/**
 * Aucune pastille quand la provenance n'est pas connue : un document de
 * cet appareil, ou un cache écrit par une version d'avant. On ne devine
 * pas, et surtout on n'annonce pas « Perso » à tort.
 */
export function provenanceFor(meta: DocumentMeta, assignments?: AssignmentIndex | null): Provenance | null {
  const origin = meta.origin
  if (origin === undefined) {
    return null
  }
  if (origin.kind === 'group') {
    return GROUP_PROVENANCE
  }
  if (origin.kind === 'personal') {
    return PERSONAL_PROVENANCE
  }
  // Le titre du devoir arrive plus tard que la liste : la pastille ne
  // dépend que de la provenance, seul le texte lu s'enrichit.
  const title = assignments?.get(origin.assignmentId)?.title
  return {
    label: 'Devoir',
    tone: 'sky',
    spoken: title === undefined ? 'Devoir' : `Devoir « ${title} »`,
  }
}
