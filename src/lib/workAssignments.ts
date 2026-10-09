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

/**
 * Ce qui reste à rendre, échéance la plus proche d'abord. Un devoir déjà
 * rendu ou déjà noté sort de la liste : le serveur a tranché, on ne
 * recalcule rien. Les devoirs sans échéance ferment la marche, parce
 * qu'ils n'ont rien d'urgent. À égalité, le titre départage, pour que
 * l'ordre ne bouge pas d'un affichage à l'autre.
 */
export function pendingAssignments(rows: readonly StudentAssignmentRow[]): StudentAssignmentRow[] {
  return rows
    .filter((row) => row.state === 'todo' || row.state === 'started')
    .sort((a, b) => {
      if (a.dueAt === null && b.dueAt === null) return a.title.localeCompare(b.title, 'fr')
      if (a.dueAt === null) return 1
      if (b.dueAt === null) return -1
      const ecart = a.dueAt.localeCompare(b.dueAt)
      return ecart === 0 ? a.title.localeCompare(b.title, 'fr') : ecart
    })
}

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
