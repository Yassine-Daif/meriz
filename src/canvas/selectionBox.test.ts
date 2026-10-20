import { describe, expect, it } from 'vitest'
import { selectionBoxInFlow } from './selectionBox'

describe('rectangle de sélection dans le modèle', () => {
  it('reste identique sans déplacement ni zoom', () => {
    const box = { x: 10, y: 20, width: 80, height: 60 }
    expect(selectionBoxInFlow(box, [0, 0, 1])).toEqual(box)
  })
  it('compense le déplacement et le zoom du participant qui sélectionne', () => {
    expect(selectionBoxInFlow({ x: 120, y: 260, width: 300, height: 160 }, [20, 60, 2]))
      .toEqual({ x: 50, y: 100, width: 150, height: 80 })
  })
  it('garde les coordonnées négatives et un zoom inférieur à un', () => {
    expect(selectionBoxInFlow({ x: 0, y: 10, width: 50, height: 30 }, [100, 50, 0.5]))
      .toEqual({ x: -200, y: -80, width: 100, height: 60 })
  })
})
