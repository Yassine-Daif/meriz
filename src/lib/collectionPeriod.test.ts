import { describe, expect, it } from 'vitest'
import { periodKey, periodLabel, currentAcademicYear } from './collectionPeriod'
import { filterCollectionItems, parseCollection } from './collectionsApi'
describe('Périodes des regroupements', () => {
  it('distingue une année scolaire et une année civile portant le même début', () => {
    expect(periodLabel({ yearStart: 2026 })).toBe('2026-2027')
    expect(periodLabel({ yearStart: 2026, periodKind: 'calendar' })).toBe(
      '2026',
    )
    expect(periodLabel({ yearStart: null })).toBe('')
    expect(periodKey({ yearStart: 2026 })).not.toBe(
      periodKey({ yearStart: 2026, periodKind: 'calendar' }),
    )
  })
  it('ne mélange pas les deux périodes dans les filtres', () => {
    const shared = {
      kind: 'groups' as const,
      archived: false,
      yearStart: 2026,
      name: 'Projets',
    }
    const collections = [
      { ...shared, id: 'a', itemIds: ['1'] },
      { ...shared, id: 'b', periodKind: 'calendar' as const, itemIds: ['2'] },
    ]
    expect(
      filterCollectionItems(
        [
          { id: '1', name: 'A' },
          { id: '2', name: 'B' },
        ],
        collections,
        'all',
        'calendar:2026',
        'active',
        '',
      ).map((i) => i.id),
    ).toEqual(['2'])
  })
  it('lit un ancien regroupement sans changer sa période', () => {
    const raw = {
      id: 'a',
      name: 'L1',
      kind: 'classrooms',
      archived: false,
      year_start: 2026,
      item_ids: [],
    }
    expect(parseCollection(raw)?.periodKind).toBe('academic')
    expect(parseCollection({ ...raw, period_kind: 'bad' })).toBeNull()
  })
  it('propose la rentrée précédente avant septembre sans imposer ce calendrier au stockage', () => {
    expect(currentAcademicYear(new Date(2026, 6, 1))).toBe(2025)
    expect(currentAcademicYear(new Date(2026, 8, 1))).toBe(2026)
  })
})
