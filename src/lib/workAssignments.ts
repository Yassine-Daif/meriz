import type { StudentAssignmentRow } from './overviewApi'

/**
 * Ce qu'un devoir apporte quand on regarde le travail de l'élève depuis
 * la liste des documents : son titre, et l'état de son rendu. Rien n'est
 * recalculé ici, le serveur reste seul juge.
 */

export type SubmissionState = 'none' | 'submitted' | 'graded'

export interface WorkAssignment {
  id: string
  title: string
  /** Le prof a préparé une base : recommencer la recopie. */
  hasBase: boolean
  submission: SubmissionState
}

export type AssignmentIndex = ReadonlyMap<string, WorkAssignment>

/** Les devoirs de l'élève, rangés par identifiant. */
export function indexAssignments(rows: readonly StudentAssignmentRow[]): AssignmentIndex {
  const index = new Map<string, WorkAssignment>()
  for (const row of rows) {
    index.set(row.id, {
      id: row.id,
      title: row.title,
      hasBase: row.hasBase,
      submission: row.submission === null ? 'none' : row.submission.status,
    })
  }
  return index
}
