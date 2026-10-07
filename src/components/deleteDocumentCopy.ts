import type { DocumentOrigin } from '../model/document'
import type { WorkAssignment } from '../lib/workAssignments'

/**
 * Le texte de la confirmation de suppression, selon ce que l'élève
 * s'apprête vraiment à perdre.
 *
 * Deux vérités à tenir, et aucune promesse au-delà :
 * - un rendu déjà déposé n'est jamais touché, c'est une copie autonome
 *   côté serveur, avec sa note et le retour du prof ;
 * - le travail en cours, lui, est perdu pour de bon. Reprendre le devoir
 *   repart de la base du prof quand il en a préparé une, sinon du dernier
 *   rendu, et d'une page vide quand rien n'a été rendu.
 */

export interface DeleteTarget {
  name: string
  /** Espace du compte, ou de ce navigateur. */
  cloud: boolean
  origin: DocumentOrigin | undefined
  /** Devoir connu, ou null quand la liste des devoirs n'est pas encore arrivée. */
  assignment: WorkAssignment | null
}

export interface DeleteCopy {
  title: string
  message: string
  confirmLabel: string
}

const WORK_TITLE = 'Supprimer ce travail de devoir'
const WORK_CONFIRM = 'Supprimer mon travail'

/** Ce que reprendre le devoir redonnera, une fois le travail supprimé. */
function restartSentence(assignment: WorkAssignment): string {
  if (assignment.hasBase) {
    return assignment.submission === 'none'
      ? 'Recommencer le devoir repartira de la base préparée par votre prof.'
      : 'Vous perdez définitivement votre travail en cours, et reprendre le devoir repartira de la base préparée par votre prof, pas de votre rendu.'
  }
  return assignment.submission === 'none'
    ? 'Recommencer le devoir repartira d’une page vide.'
    : 'Vous perdez définitivement ce que vous avez fait depuis, et reprendre le devoir repartira de la version que vous avez rendue.'
}

function assignmentMessage(name: string, assignment: WorkAssignment): string {
  const start = `Supprimer « ${name} » ? C’est votre travail sur le devoir « ${assignment.title} »`
  if (assignment.submission === 'none') {
    return `${start}, et vous n’avez encore rien rendu. Ce travail sera perdu, définitivement : rien ne permet de le retrouver. ${restartSentence(assignment)}`
  }
  const kept =
    assignment.submission === 'graded'
      ? 'Votre rendu, sa note et le retour de votre prof sont gardés : rien de tout cela ne disparaît.'
      : 'Votre rendu déjà déposé est gardé : votre prof le voit toujours, tel que vous l’avez rendu.'
  return `${start}. ${kept} ${restartSentence(assignment)}`
}

export function deleteDocumentCopy({ name, cloud, origin, assignment }: DeleteTarget): DeleteCopy {
  if (origin?.kind === 'assignment') {
    // Devoir pas encore connu : un texte vrai dans les quatre cas.
    const message =
      assignment === null
        ? `Supprimer « ${name} » ? Ce document porte votre travail sur un devoir. Ce travail sera perdu, définitivement. Vos rendus déjà déposés, leurs notes et les retours de votre prof ne sont pas touchés.`
        : assignmentMessage(name, assignment)
    return { title: WORK_TITLE, message, confirmLabel: WORK_CONFIRM }
  }
  return {
    title: 'Supprimer le document',
    message: `Supprimer « ${name} » ? Cette action est définitive${
      cloud ? ' : le document disparaît de votre compte.' : ' : le document disparaît de ce navigateur.'
    }`,
    confirmLabel: 'Supprimer',
  }
}
