import { describe, expect, it } from 'vitest'
import { electsSeeder } from './seedElection'

describe('élection de qui ensemence', () => {
  it('seul, c’est à moi de le faire', () => {
    expect(electsSeeder(42, [])).toBe(true)
  })

  it('le plus petit identifiant ensemence', () => {
    expect(electsSeeder(7, [12, 30])).toBe(true)
    expect(electsSeeder(12, [7, 30])).toBe(false)
    expect(electsSeeder(30, [7, 12])).toBe(false)
  })

  it('un seul pair gagne, donc jamais deux', () => {
    const ids = [4, 9, 15]
    expect(ids.filter((id) => electsSeeder(id, ids.filter((autre) => autre !== id)))).toEqual([4])
  })

  it('ne s’élit pas contre son propre identifiant', () => {
    expect(electsSeeder(7, [7])).toBe(false)
  })
})
