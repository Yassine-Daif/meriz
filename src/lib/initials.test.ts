import { describe, expect, it } from 'vitest'
import { initials } from './initials'

describe('initiales', () => {
  it('prend la première lettre du prénom et celle du nom', () => {
    expect(initials({ firstName: 'Ada', name: 'Lovelace' })).toBe('AL')
  })

  it('prend les deux premières lettres du nom quand le prénom manque', () => {
    expect(initials({ firstName: null, name: 'Lovelace' })).toBe('LO')
    expect(initials({ firstName: '   ', name: 'Turing' })).toBe('TU')
  })

  it('garde les accents et passe en majuscules', () => {
    expect(initials({ firstName: 'élodie', name: 'çakir' })).toBe('ÉÇ')
  })

  it('tient sur un nom d’une seule lettre ou une écriture non latine', () => {
    expect(initials({ firstName: null, name: 'X' })).toBe('X')
    expect(initials({ firstName: 'Ada', name: '' })).toBe('A')
    expect(initials({ firstName: '小', name: '明' })).toBe('小明')
  })

  it('donne un point d’interrogation quand il n’y a rien à montrer', () => {
    expect(initials({ firstName: null, name: '' })).toBe('?')
    expect(initials({ firstName: '  ', name: '   ' })).toBe('?')
  })
})
