import { describe, expect, it } from 'vitest'
import type { DocumentMeta } from '../model/document'
import type { AssignmentIndex, WorkAssignment } from '../lib/workAssignments'
import { provenanceFor } from './documentProvenance'

const meta = (origin?: DocumentMeta['origin']): DocumentMeta => ({
  id: 'd1',
  name: 'Mon MCD',
  createdAt: '2026-10-01T09:00:00Z',
  updatedAt: '2026-10-07T09:00:00Z',
  origin,
})

const devoir = (overrides: Partial<WorkAssignment> = {}): AssignmentIndex =>
  new Map([
    [
      '01JDEVOIR',
      {
        id: '01JDEVOIR',
        title: 'Modéliser une bibliothèque',
        hasBase: false,
        submission: 'none',
        ...overrides,
      } satisfies WorkAssignment,
    ],
  ])

describe('provenance affichée', () => {
  it('une provenance inconnue ne donne aucune pastille', () => {
    expect(provenanceFor(meta())).toBeNull()
  })

  it('un document personnel porte « Perso »', () => {
    expect(provenanceFor(meta({ kind: 'personal' }))).toEqual({
      label: 'Perso',
      tone: 'apricot',
      spoken: 'Perso',
    })
  })

  it('un travail de devoir porte « Devoir », jamais « Perso »', () => {
    const provenance = provenanceFor(meta({ kind: 'assignment', assignmentId: '01JDEVOIR' }))

    expect(provenance?.label).toBe('Devoir')
    expect(provenance?.tone).toBe('sky')
  })

  it('le nom du devoir entre dans le libellé lu quand il est connu', () => {
    const provenance = provenanceFor(meta({ kind: 'assignment', assignmentId: '01JDEVOIR' }), devoir())

    expect(provenance?.spoken).toBe('Devoir « Modéliser une bibliothèque »')
  })

  it('sans la liste des devoirs, le libellé lu reste « Devoir » sans nom inventé', () => {
    const attente = provenanceFor(meta({ kind: 'assignment', assignmentId: '01JDEVOIR' }), null)
    const inconnu = provenanceFor(meta({ kind: 'assignment', assignmentId: '01JAUTRE' }), devoir())

    expect(attente?.spoken).toBe('Devoir')
    expect(inconnu?.spoken).toBe('Devoir')
  })

  it('un document de groupe porte « Groupe », et son libellé lu ne change pas', () => {
    expect(provenanceFor(meta({ kind: 'group', groupId: '01JGROUPE' }))).toEqual({
      label: 'Groupe',
      tone: 'sky',
      spoken: 'Groupe',
    })
  })
})
