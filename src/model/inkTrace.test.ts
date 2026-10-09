import { describe, expect, it } from 'vitest'
import { appendInkPoint, INK_MAX_POINTS, roundInkPoint } from './inkTrace'
import type { InkPoint } from './inkTrace'

const trace = (count: number): InkPoint[] => {
  let points: InkPoint[] = []
  for (let step = 0; step < count; step += 1) {
    points = appendInkPoint(points, { x: step * 10, y: 0 })
  }
  return points
}

describe('le trait du crayon, borné', () => {
  it('garde le premier point, arrondi', () => {
    expect(appendInkPoint([], { x: 10.4, y: -3.6 })).toEqual([{ x: 10, y: -4 }])
  })

  it('ignore un point trop proche du précédent, et rend le même tableau', () => {
    const points = appendInkPoint([], { x: 100, y: 100 })

    // La même référence : rien ne change, donc rien ne repart sur le réseau.
    expect(appendInkPoint(points, { x: 102, y: 101 })).toBe(points)
  })

  it('garde un point assez éloigné, et rend un tableau neuf', () => {
    const points = appendInkPoint([], { x: 0, y: 0 })
    const next = appendInkPoint(points, { x: 10, y: 0 })

    expect(next).not.toBe(points)
    expect(next).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ])
  })

  it('arrondit les coordonnées, en positif comme en négatif', () => {
    expect(roundInkPoint({ x: 2.5, y: -2.5 })).toEqual({ x: 3, y: -2 })
    expect(roundInkPoint({ x: -7.49, y: 7.51 })).toEqual({ x: -7, y: 8 })
  })

  it('mesure la distance en diagonale, pas seulement sur un axe', () => {
    const points = appendInkPoint([], { x: 0, y: 0 })

    // 3 et 3 font 4,24 : au-delà du pas, alors qu'aucun axe seul n'y suffit.
    expect(appendInkPoint(points, { x: 3, y: 3 })).toHaveLength(2)
    expect(appendInkPoint(points, { x: 2, y: 2 })).toBe(points)
  })

  it('ne dépasse jamais soixante-quatre points', () => {
    expect(trace(200)).toHaveLength(INK_MAX_POINTS)
  })

  it('efface par la queue : le dernier point reste, le premier part', () => {
    const points = trace(INK_MAX_POINTS + 5)

    expect(points[points.length - 1]).toEqual({ x: (INK_MAX_POINTS + 4) * 10, y: 0 })
    expect(points[0]).toEqual({ x: 50, y: 0 })
  })
})
