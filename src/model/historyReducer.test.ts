import { describe, expect, it } from 'vitest'
import { createHistory, historyReducer } from './historyReducer'
import type { McdEditorState } from './mcdReducer'
import { clientCommande, inscription } from './testFixtures'

const etat = (mcd: typeof clientCommande | typeof inscription): McdEditorState => ({
  mcd,
  layout: { 'ent-client': { x: 0, y: 0 } },
})

describe('historique, adoption d’un état venu d’ailleurs', () => {
  it('remplace le présent par l’état adopté', () => {
    const history = createHistory(etat(clientCommande))
    const adopted = historyReducer(history, { type: 'ADOPT', state: etat(inscription) })
    expect(adopted.present.mcd).toBe(inscription)
  })

  it('n’historise rien : rien à annuler après une adoption', () => {
    let history = createHistory(etat(clientCommande))
    history = historyReducer(history, { type: 'RENAME_ENTITY', id: 'ent-client', name: 'Acheteur' })
    expect(history.past).toHaveLength(1)

    history = historyReducer(history, { type: 'ADOPT', state: etat(inscription) })
    expect(history.past).toEqual([])
    expect(history.future).toEqual([])
    expect(history.lastSignature).toBeNull()

    // Un Ctrl+Z après adoption ne ramène pas l'état d'avant.
    const undone = historyReducer(history, { type: 'UNDO' })
    expect(undone).toBe(history)
    expect(undone.present.mcd).toBe(inscription)
  })

  it('adopter deux fois de suite ne garde pas l’instantané précédent', () => {
    let history = createHistory(etat(clientCommande))
    history = historyReducer(history, { type: 'ADOPT', state: etat(inscription) })
    history = historyReducer(history, { type: 'ADOPT', state: etat(clientCommande) })
    expect(history.present.mcd).toBe(clientCommande)
    expect(history.past).toEqual([])
  })
})
