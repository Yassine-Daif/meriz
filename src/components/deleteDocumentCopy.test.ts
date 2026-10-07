import { describe, expect, it } from 'vitest'
import type { WorkAssignment } from '../lib/workAssignments'
import { deleteDocumentCopy } from './deleteDocumentCopy'
import type { DeleteTarget } from './deleteDocumentCopy'

const travail = (overrides: Partial<WorkAssignment> = {}): WorkAssignment => ({
  id: '01JDEVOIR',
  title: 'Modéliser une bibliothèque',
  hasBase: false,
  submission: 'none',
  ...overrides,
})

const cible = (overrides: Partial<DeleteTarget> = {}): DeleteTarget => ({
  name: 'Mon MCD',
  cloud: true,
  origin: { kind: 'personal' },
  assignment: null,
  ...overrides,
})

const devoirCible = (assignment: WorkAssignment | null): DeleteTarget =>
  cible({ origin: { kind: 'assignment', assignmentId: '01JDEVOIR' }, assignment })

describe('confirmation de suppression, documents ordinaires', () => {
  it('un document de cet appareil garde le texte d’avant, mot pour mot', () => {
    expect(deleteDocumentCopy(cible({ cloud: false, origin: undefined }))).toEqual({
      title: 'Supprimer le document',
      message: 'Supprimer « Mon MCD » ? Cette action est définitive : le document disparaît de ce navigateur.',
      confirmLabel: 'Supprimer',
    })
  })

  it('un document personnel du compte garde le texte d’avant, mot pour mot', () => {
    expect(deleteDocumentCopy(cible())).toEqual({
      title: 'Supprimer le document',
      message: 'Supprimer « Mon MCD » ? Cette action est définitive : le document disparaît de votre compte.',
      confirmLabel: 'Supprimer',
    })
  })

  it('une provenance inconnue est traitée comme un document ordinaire', () => {
    expect(deleteDocumentCopy(cible({ origin: undefined })).title).toBe('Supprimer le document')
  })

  it('un document de groupe ne parle pas de devoir', () => {
    const copy = deleteDocumentCopy(cible({ origin: { kind: 'group', groupId: '01JGROUPE' } }))

    expect(copy.title).toBe('Supprimer le document')
    expect(copy.message).not.toContain('devoir')
  })
})

describe('confirmation de suppression, travail de devoir', () => {
  it('annonce la nature du document et garde un bouton explicite', () => {
    const copy = deleteDocumentCopy(devoirCible(travail()))

    expect(copy.title).toBe('Supprimer ce travail de devoir')
    expect(copy.confirmLabel).toBe('Supprimer mon travail')
  })

  it('sans rendu, dit la perte définitive et la page vide', () => {
    const { message } = deleteDocumentCopy(devoirCible(travail()))

    expect(message).toContain('vous n’avez encore rien rendu')
    expect(message).toContain('Ce travail sera perdu, définitivement')
    expect(message).toContain('repartira d’une page vide')
  })

  it('sans rendu et avec une base, dit que l’on repart de la base du prof', () => {
    const { message } = deleteDocumentCopy(devoirCible(travail({ hasBase: true })))

    expect(message).toContain('repartira de la base préparée par votre prof')
    expect(message).not.toContain('page vide')
  })

  it('avec un rendu déposé, dit que le rendu est gardé', () => {
    const { message } = deleteDocumentCopy(devoirCible(travail({ submission: 'submitted' })))

    expect(message).toContain('Votre rendu déjà déposé est gardé')
    expect(message).toContain('votre prof le voit toujours')
    expect(message).toContain('repartira de la version que vous avez rendue')
  })

  it('avec un rendu noté, dit que la note et le retour sont gardés', () => {
    const { message } = deleteDocumentCopy(devoirCible(travail({ submission: 'graded' })))

    expect(message).toContain('sa note et le retour de votre prof sont gardés')
    expect(message).toContain('rien de tout cela ne disparaît')
  })

  it('avec un rendu et une base, annonce la base, pas le rendu, au redémarrage', () => {
    const { message } = deleteDocumentCopy(devoirCible(travail({ submission: 'graded', hasBase: true })))

    expect(message).toContain('repartira de la base préparée par votre prof, pas de votre rendu')
  })

  it('devoir pas encore connu : un texte vrai dans les quatre cas', () => {
    const { title, message, confirmLabel } = deleteDocumentCopy(devoirCible(null))

    expect(title).toBe('Supprimer ce travail de devoir')
    expect(confirmLabel).toBe('Supprimer mon travail')
    expect(message).toContain('Ce document porte votre travail sur un devoir')
    expect(message).toContain('Ce travail sera perdu, définitivement')
    expect(message).toContain(
      'Vos rendus déjà déposés, leurs notes et les retours de votre prof ne sont pas touchés',
    )
  })
})

describe('confirmation de suppression, règles de ton', () => {
  const tous = [
    cible({ cloud: false, origin: undefined }),
    cible(),
    cible({ origin: { kind: 'group', groupId: '01JGROUPE' } }),
    devoirCible(null),
    devoirCible(travail()),
    devoirCible(travail({ hasBase: true })),
    devoirCible(travail({ submission: 'submitted' })),
    devoirCible(travail({ submission: 'submitted', hasBase: true })),
    devoirCible(travail({ submission: 'graded' })),
    devoirCible(travail({ submission: 'graded', hasBase: true })),
  ]

  it('aucun texte ne promet de récupération', () => {
    for (const target of tous) {
      const { message } = deleteDocumentCopy(target)
      expect(message).not.toContain('récupér')
      expect(message).not.toContain('retrouver votre travail')
    }
  })

  it('aucun texte ne porte de tiret long', () => {
    for (const target of tous) {
      const copy = deleteDocumentCopy(target)
      const tiret = String.fromCharCode(0x2014)
      expect(copy.title).not.toContain(tiret)
      expect(copy.message).not.toContain(tiret)
      expect(copy.confirmLabel).not.toContain(tiret)
    }
  })

  it('chaque texte nomme le document', () => {
    for (const target of tous) {
      expect(deleteDocumentCopy(target).message).toContain('« Mon MCD »')
    }
  })
})
