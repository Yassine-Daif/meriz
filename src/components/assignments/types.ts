import type { ApiError } from '../../lib/apiClient'
import type { AssignmentField } from '../../lib/assignmentsApi'

/**
 * Ouvre l'outil MCD sur la base ou le corrigé d'un devoir. Le contenu
 * déjà enregistré est passé tel quel ; null veut dire « page blanche ».
 * Fourni par la racine de l'application, qui sait monter l'éditeur.
 */
export type EditAssignmentModel = (
  assignment: { id: string; classroomId: string; title: string },
  field: AssignmentField,
  content: string | null,
) => void

/**
 * Ouvre l'outil MCD sur le document de travail d'un élève pour un
 * devoir. C'est un document personnel : il s'enregistre tout seul, et
 * n'est remis au prof qu'au clic sur Rendre. Une erreur renvoyée veut
 * dire que le document n'a pas pu être ouvert (supprimé, par exemple).
 */
export type OpenWorkDocument = (
  classroomId: string,
  assignmentId: string,
  documentId: string,
  /** Devoir au suivi ouvert : le travail se partage avec le prof. */
  live?: boolean,
) => Promise<ApiError | null>

/** Modèle ouvert en consultation : rien n'est modifié ni enregistré. */
export interface ReadOnlyModel {
  classroomId: string
  assignmentId: string
  /** Rendu consulté, ou null pour un corrigé libéré. */
  submissionId: string | null
  /** Identifiant de remontage de l'éditeur, unique par contenu ouvert. */
  key: string
  /** Titre affiché dans la barre. */
  name: string
  /** Pastille de la barre, ex. « Rendu de Camille ». */
  label: string
  content: string
  /**
   * Travail suivi en direct : l'élève observé et son document. Le
   * document porte le canal de présence, qui dit qui travaille et permet
   * de corriger à deux. Absent pour un rendu ou un corrigé, qui ne
   * bougent plus.
   */
  live?: { studentId: number; documentId: string }
}

export type OpenReadOnlyModel = (model: ReadOnlyModel) => void

/**
 * Corriger en direct le travail d'un élève : le prof entre dans le
 * document de l'élève et y écrit avec lui. Le document porte le canal
 * de présence, et c'est l'élève propriétaire qui enregistre.
 */
export interface LiveCoedition {
  classroomId: string
  assignmentId: string
  studentId: number
  /** Document de l'élève : c'est lui qui porte le canal de présence. */
  documentId: string
  /** Titre affiché dans la barre. */
  name: string
  /** Pastille de la barre, ex. « Travail de Camille, correction à deux ». */
  label: string
}

export type OpenLiveCoedition = (model: LiveCoedition) => void
