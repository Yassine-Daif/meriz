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
