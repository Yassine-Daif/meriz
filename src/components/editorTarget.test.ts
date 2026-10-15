import { describe, expect, it } from 'vitest'
import { editorChrome, returnTarget } from './editorTarget'
import type { EditorTarget } from './editorTarget'

const perso: EditorTarget = { kind: 'document' }

const base: EditorTarget = {
  kind: 'assignment',
  classroomId: 'c1',
  assignmentId: 'a1',
  field: 'base',
  title: 'Les emprunts',
}

const travail = (origin: 'classes' | 'work'): EditorTarget => ({
  kind: 'work',
  classroomId: 'c1',
  assignmentId: 'a1',
  origin,
  live: false,
})

const rendu = (origin: 'classes' | 'corrections', submissionId: string | null): EditorTarget => ({
  kind: 'review',
  classroomId: 'c1',
  assignmentId: 'a1',
  submissionId,
  label: 'Rendu de Camille',
  origin,
  live: null,
})

const groupe: EditorTarget = {
  kind: 'group',
  groupId: 'g1',
  groupName: 'Révisions',
  documentId: 'd1',
}

const correctionADeux: EditorTarget = {
  kind: 'coedit',
  classroomId: 'c1',
  assignmentId: 'a1',
  studentId: 7,
  documentId: 'd1',
  label: 'Travail de Camille',
  origin: 'classes',
}

describe('où revenir en fermant l éditeur', () => {
  it('ne mène nulle part depuis un document personnel', () => {
    expect(returnTarget(perso)).toBeNull()
  })

  it('ramène au devoir, dans sa classe, depuis sa base', () => {
    expect(returnTarget(base)).toEqual({
      page: 'classes',
      opening: {
        page: 'classes',
        classroom: {
          id: 'c1',
          initial: null,
          message: null,
          assignmentId: 'a1',
          submissionId: undefined,
          assignmentTab: undefined,
        },
      },
    })
  })

  // Chaque origine a sa porte : on revient par là où on est entré.
  it('ramène à Mon travail quand on en vient', () => {
    expect(returnTarget(travail('work'))).toEqual({
      page: 'work',
      opening: { page: 'work', assignmentId: 'a1' },
    })
  })

  it('ramène aux classes quand le travail vient de là', () => {
    expect(returnTarget(travail('classes'))?.page).toBe('classes')
  })

  it('ramène au rendu dans À corriger, quand il y a un rendu', () => {
    expect(returnTarget(rendu('corrections', 's1'))).toEqual({
      page: 'corrections',
      opening: {
        page: 'corrections',
        correction: { submissionId: 's1', classroomId: 'c1', assignmentId: 'a1' },
      },
    })
  })

  // Un corrigé libéré n'a pas de rendu : il n'a rien à rouvrir dans À corriger.
  it('retombe sur la classe quand le rendu manque', () => {
    expect(returnTarget(rendu('corrections', null))?.page).toBe('classes')
  })

  it('ramène à l onglet documents de son groupe', () => {
    expect(returnTarget(groupe)).toEqual({
      page: 'groups',
      opening: {
        page: 'groups',
        group: { id: 'g1', initial: null, message: null, tab: 'documents' },
      },
    })
  })

  it('ramène au suivi après une correction à deux', () => {
    const back = returnTarget(correctionADeux)
    expect(back?.page).toBe('classes')
    expect(back?.opening).toMatchObject({ page: 'classes', classroom: { assignmentTab: 'suivi' } })
  })

  it('ramène aussi au suivi après un travail observé en direct', () => {
    const observe: EditorTarget = {
      ...rendu('classes', 's1'),
      live: { studentId: 7, documentId: 'd1' },
    } as EditorTarget
    expect(returnTarget(observe)?.opening).toMatchObject({
      classroom: { assignmentTab: 'suivi' },
    })
  })
})

describe('ce que propose la barre de l éditeur', () => {
  it('laisse renommer un document personnel, et lui seul', () => {
    expect(editorChrome(perso)).toEqual({ canRename: true, documentActions: true, readOnly: false })
    for (const cible of [base, travail('classes'), rendu('classes', 's1'), groupe, correctionADeux]) {
      expect(editorChrome(cible).canRename).toBe(false)
      expect(editorChrome(cible).documentActions).toBe(false)
    }
  })

  it('met la consultation d un rendu en lecture seule, et rien d autre', () => {
    expect(editorChrome(rendu('classes', 's1')).readOnly).toBe(true)
    for (const cible of [perso, base, travail('classes'), groupe, correctionADeux]) {
      expect(editorChrome(cible).readOnly).toBe(false)
    }
  })

  it('nomme le retour selon ce qui est ouvert', () => {
    expect(editorChrome(base).backLabel).toBe('Retour au devoir')
    expect(editorChrome(rendu('classes', 's1')).backLabel).toBe('Retour au rendu')
    expect(editorChrome(rendu('classes', null)).backLabel).toBe('Retour au devoir')
    expect(editorChrome(groupe).backLabel).toBe('Retour au groupe')
    expect(editorChrome(correctionADeux).backLabel).toBe('Retour au suivi')
  })

  it('affiche le champ du devoir, et le nom du groupe', () => {
    expect(editorChrome(base).contentLabel).toBe('Base du devoir')
    expect(editorChrome({ ...base, field: 'solution' }).contentLabel).toBe('Corrigé du devoir')
    expect(editorChrome(groupe).contentLabel).toBe('Groupe « Révisions »')
  })
})
