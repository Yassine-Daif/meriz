import { describe, expect, it } from 'vitest'
import { ANCHOR_SIDES, anchorBox, pickAnchors } from './anchors'
import type { AnchorBox } from './anchors'

const box = (x: number, y: number, width: number, height: number): AnchorBox => ({
  x,
  y,
  width,
  height,
})

describe('pickAnchors, le côté d’accroche d’une patte', () => {
  it('accroche en haut une carte large et basse, là où l’axe dominant dirait à droite', () => {
    // Écart horizontal plus grand que l'écart vertical, mais la carte est
    // trois fois plus large que haute : le trait sort par le haut.
    const carte = box(0, 0, 240, 80)
    const capsule = box(150, -42, 140, 44)

    const anchors = pickAnchors(capsule, carte)

    expect(anchors.sourceHandle).toBe('bottom')
    expect(anchors.targetHandle).toBe('top')
  })

  it('accroche en bas et en haut deux blocs empilés', () => {
    expect(pickAnchors(box(0, 0, 150, 50), box(0, 300, 150, 50))).toEqual({
      sourceHandle: 'bottom',
      targetHandle: 'top',
    })
  })

  it('accroche à droite et à gauche deux blocs côte à côte', () => {
    expect(pickAnchors(box(0, 0, 150, 50), box(400, 0, 150, 50))).toEqual({
      sourceHandle: 'right',
      targetHandle: 'left',
    })
  })

  it('à égalité parfaite sur la diagonale, l’horizontale gagne, et toujours la même', () => {
    // Centres écartés de 100 en x et 100 en y, blocs carrés : égalité.
    const premier = pickAnchors(box(0, 0, 100, 100), box(100, 100, 100, 100))
    const second = pickAnchors(box(0, 0, 100, 100), box(100, 100, 100, 100))

    expect(premier).toEqual({ sourceHandle: 'right', targetHandle: 'left' })
    expect(second).toEqual(premier)
  })

  it('donne des côtés différents selon la forme, à écart identique', () => {
    const carre = pickAnchors(box(0, 0, 100, 100), box(120, 90, 100, 100))
    const large = pickAnchors(box(0, 0, 300, 60), box(120, 90, 100, 100))

    expect(carre.sourceHandle).toBe('right')
    expect(large.sourceHandle).toBe('bottom')
  })

  it('est symétrique : échanger source et cible échange les côtés', () => {
    const paires: [AnchorBox, AnchorBox][] = [
      [box(0, 0, 176, 88), box(400, 20, 152, 48)],
      [box(0, 0, 176, 88), box(-300, 250, 152, 48)],
      [box(10, 10, 240, 60), box(60, 300, 100, 100)],
      [box(0, 0, 120, 300), box(500, 10, 120, 300)],
      [box(0, 0, 100, 100), box(-80, -90, 100, 100)],
    ]

    for (const [a, b] of paires) {
      const direct = pickAnchors(a, b)
      const inverse = pickAnchors(b, a)
      expect(direct.sourceHandle).toBe(inverse.targetHandle)
      expect(direct.targetHandle).toBe(inverse.sourceHandle)
    }
  })

  it('reste défini et stable pour deux blocs de même centre, sans NaN', () => {
    // Cas dégénéré : aucun côté n'est meilleur qu'un autre, mais il en faut
    // un, toujours le même, et jamais undefined.
    const anchors = pickAnchors(box(0, 0, 150, 50), box(0, 0, 150, 50))

    expect(ANCHOR_SIDES).toContain(anchors.sourceHandle)
    expect(ANCHOR_SIDES).toContain(anchors.targetHandle)
    expect(pickAnchors(box(0, 0, 150, 50), box(0, 0, 150, 50))).toEqual(anchors)
  })

  it('reste défini pour deux blocs qui se chevauchent à moitié', () => {
    const anchors = pickAnchors(box(0, 0, 200, 100), box(100, 30, 200, 100))

    expect(ANCHOR_SIDES).toContain(anchors.sourceHandle)
    expect(ANCHOR_SIDES).toContain(anchors.targetHandle)
  })

  it('ne rend jamais qu’un des quatre identifiants de rond existants', () => {
    // Le garde-fou logique : un côté inconnu ferait disparaître la patte.
    for (let dx = -400; dx <= 400; dx += 80) {
      for (let dy = -400; dy <= 400; dy += 80) {
        const anchors = pickAnchors(box(0, 0, 176, 88), box(dx, dy, 152, 48))
        expect(ANCHOR_SIDES).toContain(anchors.sourceHandle)
        expect(ANCHOR_SIDES).toContain(anchors.targetHandle)
      }
    }
  })
})

describe('anchorBox, la boîte d’un nœud', () => {
  it('garde la position et prend la taille mesurée', () => {
    expect(anchorBox({ type: 'entity', position: { x: 5, y: 7 }, measured: { width: 200, height: 120 } })).toEqual(
      { x: 5, y: 7, width: 200, height: 120 },
    )
  })

  it('prend un repli par nature de bloc tant que la mesure n’est pas là', () => {
    const entite = anchorBox({ type: 'entity', position: { x: 0, y: 0 } })
    const association = anchorBox({ type: 'association', position: { x: 0, y: 0 } })

    expect(entite.width).toBeGreaterThan(association.width)
    expect(entite.height).toBeGreaterThan(association.height)
    // Le repli garde le bon rapport de forme dès la première image.
    expect(entite.width).toBeGreaterThan(entite.height)
    expect(association.width).toBeGreaterThan(association.height)
  })

  it('traite une taille nulle comme une taille manquante', () => {
    const plat = anchorBox({ type: 'entity', position: { x: 0, y: 0 }, measured: { width: 0, height: 0 } })
    const absent = anchorBox({ type: 'entity', position: { x: 0, y: 0 } })

    expect(plat).toEqual(absent)
  })
})
