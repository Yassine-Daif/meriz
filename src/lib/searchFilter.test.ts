import { describe, expect, it } from 'vitest'
import { filterByName, foldForSearch, matchesName, searchCountLabel } from './searchFilter'

describe('pli de recherche', () => {
  it('retire les accents et passe en minuscules', () => {
    expect(foldForSearch('ÉLÈVES')).toBe('eleves')
    expect(foldForSearch('Prépa Été')).toBe('prepa ete')
  })

  it('réduit les suites d espaces à une seule, et rogne les bords', () => {
    expect(foldForSearch('  BUT   2   SI  ')).toBe('but 2 si')
  })

  it('garde les séparateurs, contrairement au pli du modèle', () => {
    // normalizeName de compare.ts rendrait « abc » ici : ce serait faux
    // pour une recherche, « abc » ne doit pas trouver « a b c ».
    expect(foldForSearch('a b c')).toBe('a b c')
  })
})

describe('correspondance d un nom', () => {
  it('ignore les accents dans les deux sens', () => {
    expect(matchesName('Élèves de seconde', 'eleves')).toBe(true)
    expect(matchesName('Eleves de seconde', 'élèves')).toBe(true)
  })

  it('ignore la casse', () => {
    expect(matchesName('BUT 2 SI', 'but')).toBe(true)
  })

  it('trouve un mot au milieu du nom', () => {
    expect(matchesName('Groupe de seconde B', 'seconde')).toBe(true)
  })

  it('refuse ce qui ne figure pas dans le nom', () => {
    expect(matchesName('BUT 2 SI', 'mmi')).toBe(false)
  })

  it('refuse un nom dont les espaces ne sont pas ceux de la recherche', () => {
    expect(matchesName('a b c', 'abc')).toBe(false)
  })

  it('accepte tout quand la recherche est vide ou pleine d espaces', () => {
    expect(matchesName('BUT 2 SI', '')).toBe(true)
    expect(matchesName('BUT 2 SI', '   ')).toBe(true)
  })
})

describe('filtre d une liste', () => {
  const liste = [
    { id: '1', name: 'BUT 2 SI' },
    { id: '2', name: 'Élèves de seconde' },
    { id: '3', name: 'BUT 1 Info' },
  ]

  it('garde l ordre d origine', () => {
    expect(filterByName(liste, 'but').map((item) => item.id)).toEqual(['1', '3'])
  })

  it('rend la liste entière quand la recherche est vide', () => {
    expect(filterByName(liste, '')).toHaveLength(3)
  })

  it('ne modifie pas le tableau reçu', () => {
    const copie = [...liste]
    filterByName(liste, 'but')
    expect(liste).toEqual(copie)
  })

  it('rend une liste vide quand rien ne correspond', () => {
    expect(filterByName(liste, 'zzz')).toEqual([])
  })
})

describe('compte affiché', () => {
  it('donne le compte seul quand rien n est filtré', () => {
    expect(searchCountLabel(12, 12, 'classe', 'classes')).toBe('12 classes')
    expect(searchCountLabel(1, 1, 'classe', 'classes')).toBe('1 classe')
    expect(searchCountLabel(0, 0, 'classe', 'classes')).toBe('0 classe')
  })

  it('dit la part affichée pendant une recherche', () => {
    expect(searchCountLabel(3, 12, 'classe', 'classes')).toBe('3 classes sur 12')
    expect(searchCountLabel(1, 12, 'groupe', 'groupes')).toBe('1 groupe sur 12')
    expect(searchCountLabel(0, 12, 'classe', 'classes')).toBe('0 classe sur 12')
  })
})
