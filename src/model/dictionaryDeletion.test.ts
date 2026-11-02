import { describe, expect, it } from 'vitest'
import { createModelDoc } from './modelDoc'
import { mcdReducer } from './mcdReducer'
import type { McdEditorState } from './mcdReducer'
import { clientCommande } from './testFixtures'
import { findPlacement } from './queries'

const initial = (): McdEditorState => ({
  mcd: structuredClone(clientCommande), layout: { 'ent-client': { x: 10, y: 20 } },
  mpd: { dialect: 'mysql', overrides: { 'prop-nom-client': 'VARCHAR(150)', 'prop-date-commande': 'DATE' }, identity: { 'prop-num-client': false } },
})

describe('suppression d’une table du dictionnaire', () => {
  it('retire la table, ses propriétés, les pattes et les paramètres concernés en une étape annulable', () => {
    const state = initial(), doc = createModelDoc(state)
    try {
      doc.apply({ type: 'DELETE_DICTIONARY_TABLE', id: 'ent-client' })
      const next = doc.snapshot()
      expect(next.mcd.entities.some(e => e.id === 'ent-client')).toBe(false)
      expect(next.mcd.properties.some(p => p.id === 'prop-nom-client')).toBe(false)
      expect(next.mcd.associations.flatMap(a => a.legs).some(l => l.entityId === 'ent-client')).toBe(false)
      expect(next.mpd?.overrides).toEqual({ 'prop-date-commande': 'DATE' })
      expect(next.mpd?.identity?.['prop-num-client']).toBeUndefined()
      doc.undo()
      expect(doc.snapshot()).toEqual(state)
      doc.redo()
      expect(doc.snapshot().mcd.entities).toHaveLength(1)
    } finally { doc.destroy() }
  })
  it('permet de supprimer la table tout en gardant ses propriétés et leurs réglages', () => {
    const state = initial(), next = mcdReducer(state, { type: 'DELETE_ENTITY', id: 'ent-client' })
    expect(next.mcd.properties).toEqual(state.mcd.properties)
    expect(next.mpd).toEqual(state.mpd)
    expect(findPlacement(next.mcd, 'prop-nom-client')).toBeUndefined()
  })
  it('conserve une propriété déplacée ailleurs avant la confirmation', () => {
    const state = mcdReducer(initial(), { type: 'MOVE_PROPERTY', propertyId: 'prop-nom-client', ownerId: 'ent-commande' })
    const next = mcdReducer(state, { type: 'DELETE_DICTIONARY_TABLE', id: 'ent-client' })
    expect(findPlacement(next.mcd, 'prop-nom-client')?.owner.id).toBe('ent-commande')
    expect(next.mpd?.overrides['prop-nom-client']).toBe('VARCHAR(150)')
  })
  it('ignore une table déjà supprimée par un autre participant', () => {
    const state = initial()
    expect(mcdReducer(state, { type: 'DELETE_DICTIONARY_TABLE', id: 'absente' })).toBe(state)
  })
})
