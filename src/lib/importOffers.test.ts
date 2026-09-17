import { describe, expect, it } from 'vitest'
import { createMemoryStorage } from './documentStore'
import { markOffered, unofferedLocalIds } from './importOffers'

describe("proposition d'import, par compte", () => {
  it('ne repropose que les documents locaux nouveaux', () => {
    const storage = createMemoryStorage()
    expect(unofferedLocalIds(storage, 'A', ['l1', 'l2'])).toEqual(['l1', 'l2'])

    markOffered(storage, 'A', ['l1', 'l2'])

    expect(unofferedLocalIds(storage, 'A', ['l1', 'l2'])).toEqual([])
    expect(unofferedLocalIds(storage, 'A', ['l1', 'l2', 'l3'])).toEqual(['l3'])
  })

  it("garde un suivi distinct pour chaque compte", () => {
    const storage = createMemoryStorage()
    markOffered(storage, 'A', ['l1'])

    expect(unofferedLocalIds(storage, 'B', ['l1'])).toEqual(['l1'])
  })

  it('tolère un suivi corrompu : la proposition revient, rien ne plante', () => {
    const storage = createMemoryStorage()
    storage.setItem('meriz-import-offered:A', '{oups')

    expect(unofferedLocalIds(storage, 'A', ['l1'])).toEqual(['l1'])
  })
})
