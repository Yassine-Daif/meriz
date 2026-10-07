import { describe, expect, it } from 'vitest'
import type { StudentAssignmentRow } from './overviewApi'
import { indexAssignments } from './workAssignments'

const row = (overrides: Partial<StudentAssignmentRow> = {}): StudentAssignmentRow => ({
  id: '01JDEVOIR',
  title: 'Modéliser une bibliothèque',
  type: 'exercise',
  dueAt: null,
  isOverdue: false,
  classroom: { id: '01JCLASSE', name: 'BUT MMI 2' },
  hasBase: false,
  hasImage: false,
  state: 'started',
  documentId: 'doc-1',
  submission: null,
  ...overrides,
})

const submission = (status: 'submitted' | 'graded') => ({
  id: '01JRENDU',
  status,
  submittedAt: '2026-10-03T09:00:00Z',
  isLate: false,
  grade: status === 'graded' ? '17/20' : null,
  feedback: status === 'graded' ? 'Très bien.' : null,
  gradedAt: status === 'graded' ? '2026-10-05T09:00:00Z' : null,
})

describe('index des devoirs de l’élève', () => {
  it('range les devoirs par identifiant, avec titre et base', () => {
    const index = indexAssignments([row(), row({ id: '01JAUTRE', title: 'Les vols', hasBase: true })])

    expect(index.get('01JDEVOIR')).toEqual({
      id: '01JDEVOIR',
      title: 'Modéliser une bibliothèque',
      hasBase: false,
      submission: 'none',
    })
    expect(index.get('01JAUTRE')?.hasBase).toBe(true)
  })

  it('un devoir sans rendu donne « none »', () => {
    expect(indexAssignments([row()]).get('01JDEVOIR')?.submission).toBe('none')
  })

  it('un rendu déposé donne « submitted », un rendu noté donne « graded »', () => {
    const depose = indexAssignments([row({ submission: submission('submitted') })])
    const note = indexAssignments([row({ submission: submission('graded') })])

    expect(depose.get('01JDEVOIR')?.submission).toBe('submitted')
    expect(note.get('01JDEVOIR')?.submission).toBe('graded')
  })

  it('aucun devoir donne un index vide', () => {
    expect(indexAssignments([]).size).toBe(0)
  })
})
