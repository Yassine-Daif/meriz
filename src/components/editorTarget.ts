import type { OpenedDocument } from '../model/document'
import type { DocumentSaver } from '../lib/documentRepository'
import type { AssignmentField } from '../lib/assignmentsApi'
import type { SessionState } from '../lib/sessionState'
import type { CollabUser } from '../model/collabProvider'
import type { ClassroomOpening } from './ClassesPage'
import type { ConnectedPage } from './ConnectedShell'
import type { CorrectionOpening } from './CorrectionsPage'
import type { GroupOpening } from './groups/GroupsPage'
import type { CollaborationInfo } from './useCollaboration'

/**
 * Ce que l'éditeur travaille, et tout ce qui s'en déduit.
 *
 * Ce module ne contient que du calcul pur : à partir de la cible
 * ouverte, il dit le contexte collaboratif, le fil de commentaires, ce
 * que propose la barre de l'éditeur, et où revenir en fermant. Aucun
 * état, aucun effet, donc tout s'y vérifie par un test.
 */

/**
 * Ce que l'éditeur MCD est en train de travailler : un document
 * personnel, la base ou le corrigé d'un devoir, le travail d'un élève
 * sur un devoir, ou un modèle consulté sans y toucher. La cible décide
 * du titre affiché, du renommage, de la lecture seule et du retour.
 */
export type EditorTarget =
  | { kind: 'document' }
  | {
      kind: 'assignment'
      classroomId: string
      assignmentId: string
      field: AssignmentField
      title: string
    }
  | {
      kind: 'work'
      classroomId: string
      assignmentId: string
      origin: EditorOrigin
      /** Devoir au suivi ouvert : le travail se partage avec le prof. */
      live: boolean
    }
  | {
      kind: 'review'
      classroomId: string
      assignmentId: string
      /** Rendu consulté, ou null pour un corrigé libéré. */
      submissionId: string | null
      discussionDocumentId?: string
      label: string
      origin: EditorOrigin
      /** Travail suivi en direct : l'élève observé et son document. */
      live: { studentId: number; documentId: string } | null
    }
  /** Un document partagé d'un groupe, travaillé entre pairs. */
  | {
      kind: 'group'
      groupId: string
      groupName: string
      documentId: string
    }
  /** Le travail d'un élève, corrigé à deux par son prof. */
  | {
      kind: 'coedit'
      classroomId: string
      assignmentId: string
      studentId: number
      documentId: string
      label: string
      origin: EditorOrigin
    }

/** La page d'où l'outil a été ouvert, celle où fermer doit ramener. */
export type EditorOrigin = 'classes' | 'corrections' | 'work'

/**
 * Le contexte collaboratif d'une cible, ou rien. L'élève partage son
 * travail quand le devoir est suivi. Le prof reçoit en observateur
 * silencieux avant de se présenter pour corriger à deux. Les membres
 * d'un groupe se retrouvent toujours comme pairs visibles.
 */
export function collaborationFor(
  target: EditorTarget,
  session: SessionState,
  documentId: string | null,
): CollaborationInfo | undefined {
  if (session.status !== 'signed-in' || documentId === null) {
    return undefined
  }
  const user = session.user
  const me: CollabUser = {
    id: user.id,
    name: user.name,
    firstName: user.firstName,
    role: user.role,
    avatarBg: user.avatarBg,
    avatarFg: user.avatarFg,
  }
  if (target.kind === 'work' && target.live) {
    return { documentId, me, role: 'owner' }
  }
  if (target.kind === 'review' && target.live !== null) {
    return { documentId: target.live.documentId, me, role: 'observer', ownerId: target.live.studentId }
  }
  if (target.kind === 'coedit') {
    return { documentId: target.documentId, me, role: 'guest', ownerId: target.studentId }
  }
  if (target.kind === 'group') {
    return { documentId: target.documentId, me, role: 'member' }
  }
  return undefined
}

/**
 * Le document de travail dont on peut tenir le fil de correction, ou
 * null.
 *
 * Les commentaires se rattachent à un document réel du compte. Les
 * autres cibles portent un identifiant fabriqué pour l'éditeur, par
 * exemple la base d'un devoir sous `${assignment.id}:base` : il n'y a
 * rien à commenter derrière. Un document personnel est exclu par
 * périmètre : le fil sert la correction d'un travail.
 */
export function commentsDocumentId(target: EditorTarget, document: OpenedDocument): string | null {
  switch (target.kind) {
    case 'work':
      return document.meta.id
    case 'group':
      return target.documentId
    case 'coedit':
      return target.documentId
    case 'review':
      // Un travail suivi a bien un document. Un rendu déposé, lui, n'est
      // qu'un instantané : rien à commenter.
      return target.live?.documentId ?? target.discussionDocumentId ?? null
    default:
      return null
  }
}

/**
 * Ce qu'une page doit rouvrir en arrivant. Seule la page visée lit sa
 * charge : personne d'autre n'a à la comprendre.
 */
export type Opening =
  | { page: 'classes'; classroom: ClassroomOpening }
  | { page: 'corrections'; correction: CorrectionOpening }
  | { page: 'work'; assignmentId: string }
  | { page: 'groups'; group: GroupOpening }

/** Modèle ouvert, sa sauvegarde automatique, et l'espace d'où il vient. */
export interface OpenedSession {
  spaceKey: string
  document: OpenedDocument
  saver: DocumentSaver
  cloud: boolean
  target: EditorTarget
}

const FIELD_LABEL: Record<AssignmentField, string> = {
  base: 'Base du devoir',
  solution: 'Corrigé du devoir',
}

/** Ce que la barre de l'éditeur propose, selon ce qui est ouvert. */
export interface EditorChrome {
  contentLabel?: string
  backLabel?: string
  /** Le titre se renomme depuis la barre : documents personnels seulement. */
  canRename: boolean
  /** Nouveau document et Ouvrir un fichier : hors de l'espace documents, non. */
  documentActions: boolean
  readOnly: boolean
}

export function editorChrome(target: EditorTarget): EditorChrome {
  switch (target.kind) {
    case 'document':
      return { canRename: true, documentActions: true, readOnly: false }
    case 'assignment':
      return {
        contentLabel: FIELD_LABEL[target.field],
        backLabel: 'Retour au devoir',
        canRename: false,
        documentActions: false,
        readOnly: false,
      }
    case 'work':
      // Le titre est celui de l'exercice, donné par le prof : on l'affiche,
      // on ne le renomme pas. Le serveur le réécrit de toute façon chaque
      // fois que l'élève reprend le devoir.
      return {
        contentLabel: 'Devoir',
        backLabel: 'Retour au devoir',
        canRename: false,
        documentActions: false,
        readOnly: false,
      }
    case 'review':
      return {
        contentLabel: target.label,
        backLabel: target.submissionId === null ? 'Retour au devoir' : 'Retour au rendu',
        canRename: false,
        documentActions: false,
        readOnly: true,
      }
    case 'group':
      /*
       * Document du groupe : tout membre y écrit et l'enregistre. Le nom
       * est commun, donc il se renomme depuis la liste du groupe, pas
       * depuis la barre, et les actions de documents personnels n'ont
       * rien à faire ici.
       */
      return {
        contentLabel: `Groupe « ${target.groupName} »`,
        backLabel: 'Retour au groupe',
        canRename: false,
        documentActions: false,
        readOnly: false,
      }
    case 'coedit':
      // Correction à deux : le prof écrit dans le modèle partagé, mais
      // c'est l'élève qui l'enregistre, et le titre reste le sien.
      return {
        contentLabel: target.label,
        backLabel: 'Retour au suivi',
        canRename: false,
        documentActions: false,
        readOnly: false,
      }
  }
}

/**
 * Où revenir en fermant l'éditeur, ou null pour un document personnel,
 * qui ramène simplement à ses documents.
 *
 * Tout ce qui vient d'un devoir y retourne : on ne retombe jamais sur
 * l'accueil après avoir dessiné une base, travaillé ou consulté. Et on
 * revient par la porte d'entrée, celle de la page d'origine.
 */
export function returnTarget(target: EditorTarget): { page: ConnectedPage; opening: Opening } | null {
  if (target.kind === 'document') {
    return null
  }
  if (target.kind === 'group') {
    return {
      page: 'groups',
      opening: {
        page: 'groups',
        group: { id: target.groupId, initial: null, message: null, tab: 'documents' },
      },
    }
  }
  const origin =
    target.kind === 'work' || target.kind === 'review' || target.kind === 'coedit'
      ? target.origin
      : 'classes'
  if (origin === 'corrections' && target.kind === 'review' && target.submissionId !== null) {
    return {
      page: 'corrections',
      opening: {
        page: 'corrections',
        correction: {
          submissionId: target.submissionId,
          classroomId: target.classroomId,
          assignmentId: target.assignmentId,
        },
      },
    }
  }
  if (origin === 'work') {
    return { page: 'work', opening: { page: 'work', assignmentId: target.assignmentId } }
  }
  return {
    page: 'classes',
    opening: {
      page: 'classes',
      classroom: {
        id: target.classroomId,
        initial: null,
        message: null,
        assignmentId: target.assignmentId,
        submissionId: target.kind === 'review' ? (target.submissionId ?? undefined) : undefined,
        // Un travail observé ou corrigé à deux ramène au suivi, là où le
        // prof l'a ouvert.
        assignmentTab:
          target.kind === 'coedit' || (target.kind === 'review' && target.live !== null)
            ? 'suivi'
            : undefined,
      },
    },
  }
}
