import { describe, expect, it } from 'vitest'
import { documentOrigin } from './document'

describe('provenance d’un document', () => {
  it('sans devoir ni groupe, le document est personnel', () => {
    expect(documentOrigin(null, null)).toEqual({ kind: 'personal' })
  })

  it('avec un devoir, le document porte le travail de ce devoir', () => {
    expect(documentOrigin('01JDEVOIR', null)).toEqual({ kind: 'assignment', assignmentId: '01JDEVOIR' })
  })

  it('avec un groupe, le document est partagé', () => {
    expect(documentOrigin(null, '01JGROUPE')).toEqual({ kind: 'group', groupId: '01JGROUPE' })
  })

  it('le groupe l’emporte : un document partagé n’est le travail de personne seul', () => {
    expect(documentOrigin('01JDEVOIR', '01JGROUPE')).toEqual({ kind: 'group', groupId: '01JGROUPE' })
  })
})
