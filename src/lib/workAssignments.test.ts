import { describe, expect, it } from 'vitest'
import type { StudentAssignmentRow } from './overviewApi'
import { indexAssignments, pendingAssignments } from './workAssignments'

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

describe('ce qui reste à rendre', () => {
  it('écarte les devoirs rendus et les devoirs notés', () => {
    const reste = pendingAssignments([
      row({ id: 'a', state: 'todo' }),
      row({ id: 'b', state: 'started' }),
      row({ id: 'c', state: 'submitted', submission: submission('submitted') }),
      row({ id: 'd', state: 'graded', submission: submission('graded') }),
    ])

    expect(reste.map((item) => item.id)).toEqual(['a', 'b'])
  })

  it('met l’échéance la plus proche en premier', () => {
    const reste = pendingAssignments([
      row({ id: 'tard', dueAt: '2026-12-01T18:00:00Z' }),
      row({ id: 'tot', dueAt: '2026-10-01T18:00:00Z' }),
    ])

    expect(reste.map((item) => item.id)).toEqual(['tot', 'tard'])
  })

  it('renvoie les devoirs sans échéance à la fin', () => {
    const reste = pendingAssignments([
      row({ id: 'sans', dueAt: null }),
      row({ id: 'avec', dueAt: '2026-12-01T18:00:00Z' }),
    ])

    expect(reste.map((item) => item.id)).toEqual(['avec', 'sans'])
  })

  it('départage par le titre à échéance égale, pour un ordre stable', () => {
    const reste = pendingAssignments([
      row({ id: 'b', title: 'Vols', dueAt: '2026-10-01T18:00:00Z' }),
      row({ id: 'a', title: 'Bibliothèque', dueAt: '2026-10-01T18:00:00Z' }),
    ])

    expect(reste.map((item) => item.id)).toEqual(['a', 'b'])
  })

  it('ne modifie pas le tableau reçu', () => {
    const liste = [row({ id: 'tard', dueAt: '2026-12-01T18:00:00Z' }), row({ id: 'tot', dueAt: '2026-10-01T18:00:00Z' })]
    const copie = liste.map((item) => item.id)
    pendingAssignments(liste)
    expect(liste.map((item) => item.id)).toEqual(copie)
  })
})
