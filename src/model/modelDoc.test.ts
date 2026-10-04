import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_MPD_SETTINGS } from './mpd'
import { mcdReducer } from './mcdReducer'
import type { McdAction, McdEditorState } from './mcdReducer'
import { createModelDoc } from './modelDoc'
import { parseModelFile, serializeModel } from '../lib/persistence'
import { clientCommande, inscription, tutorat, vols } from './testFixtures'
import { exampleLayout } from './example'
import { findPlacement, unplacedProperties } from './queries'

/**
 * L'essai différentiel est le filet de ce chantier : pour chaque action,
 * le document Yjs doit rendre exactement ce que rend le réducteur, et se
 * sérialiser à l'octet près de la même façon.
 *
 * Les identifiants sont tirés au sort en production. On les rend
 * prévisibles, et on remet le compteur à zéro avant chaque chemin : les
 * deux parcours voient alors la même suite d'identifiants.
 */
let counter = 0
const uuid = vi
  .spyOn(globalThis.crypto, 'randomUUID')
  .mockImplementation(() => `id-${(counter += 1)}` as ReturnType<typeof crypto.randomUUID>)

afterAll(() => {
  uuid.mockRestore()
})

beforeEach(() => {
  counter = 0
})

type Mcd = McdEditorState['mcd']

const stateOf = (mcd: Mcd): McdEditorState => ({ mcd, layout: { ...exampleLayout } })

const EMPTY: McdEditorState = { mcd: { properties: [], entities: [], associations: [] }, layout: {} }

/** Une action construite à partir de l'état courant, pour viser des ids réels. */
type Step = (state: McdEditorState) => McdAction

function reduce(initial: McdEditorState, steps: readonly Step[]): McdEditorState {
  counter = 0
  let state = initial
  for (const step of steps) {
    state = mcdReducer(state, step(state))
  }
  return state
}

function onDoc(initial: McdEditorState, steps: readonly Step[]) {
  counter = 0
  const doc = createModelDoc(initial)
  for (const step of steps) {
    doc.apply(step(doc.snapshot()))
  }
  return doc
}

const serialized = (state: McdEditorState) => serializeModel(state, DEFAULT_MPD_SETTINGS)

/** Le document et le réducteur doivent être indiscernables. */
function expectSameAsReducer(initial: McdEditorState, steps: readonly Step[]): void {
  const expected = reduce(initial, steps)
  const doc = onDoc(initial, steps)
  expect(doc.snapshot()).toEqual(expected)
  expect(serialized(doc.snapshot())).toBe(serialized(expected))
  doc.destroy()
}

/* ------------------------------------------------------------------ */

const firstEntity = (state: McdEditorState) => state.mcd.entities[0]!
const firstAssociation = (state: McdEditorState) => state.mcd.associations[0]!
const firstLeg = (state: McdEditorState) => firstAssociation(state).legs[0]!

/** Un pas par action du modèle, chacun visant quelque chose qui existe. */
const SCENARIOS: Record<string, Step[]> = {
  ADD_ENTITY: [() => ({ type: 'ADD_ENTITY', position: { x: 10, y: 20 } })],
  ADD_ENTITY_DEUX_FOIS: [
    () => ({ type: 'ADD_ENTITY', position: { x: 10, y: 20 } }),
    () => ({ type: 'ADD_ENTITY', position: { x: 30, y: 40 } }),
  ],
  ADD_ASSOCIATION: [() => ({ type: 'ADD_ASSOCIATION', position: { x: 50, y: 60 } })],
  ADD_LEG: [
    (state) => ({
      type: 'ADD_LEG',
      associationId: firstAssociation(state).id,
      entityId: firstEntity(state).id,
    }),
  ],
  MOVE_NODE: [(state) => ({ type: 'MOVE_NODE', id: firstEntity(state).id, position: { x: 7, y: 8 } })],
  MOVE_NODE_SUR_UNE_PATTE: [
    (state) => ({ type: 'MOVE_NODE', id: firstLeg(state).id, position: { x: 1, y: 2 } }),
  ],
  MOVE_NODES: [
    (state) => ({
      type: 'MOVE_NODES',
      moves: [
        { id: firstEntity(state).id, position: { x: 11, y: 12 } },
        { id: firstAssociation(state).id, position: { x: 13, y: 14 } },
      ],
    }),
  ],
  DELETE_ENTITY: [(state) => ({ type: 'DELETE_ENTITY', id: firstEntity(state).id })],
  DELETE_ASSOCIATION: [(state) => ({ type: 'DELETE_ASSOCIATION', id: firstAssociation(state).id })],
  DELETE_LEG: [(state) => ({ type: 'DELETE_LEG', id: firstLeg(state).id })],
  RENAME_ENTITY: [(state) => ({ type: 'RENAME_ENTITY', id: firstEntity(state).id, name: 'Acheteur' })],
  RENAME_ASSOCIATION: [
    (state) => ({ type: 'RENAME_ASSOCIATION', id: firstAssociation(state).id, name: 'commander' }),
  ],
  ADD_PROPERTY: [() => ({ type: 'ADD_PROPERTY' })],
  UPDATE_PROPERTY_NOM: [
    (state) => ({ type: 'UPDATE_PROPERTY', propertyId: state.mcd.properties[0]!.id, patch: { name: 'numero' } }),
  ],
  UPDATE_PROPERTY_TYPE: [
    (state) => ({ type: 'UPDATE_PROPERTY', propertyId: state.mcd.properties[0]!.id, patch: { type: 'texte' } }),
  ],
  UPDATE_PROPERTY_TAILLE: [
    (state) => ({ type: 'UPDATE_PROPERTY', propertyId: state.mcd.properties[0]!.id, patch: { size: 42 } }),
  ],
  UPDATE_PROPERTY_TAILLE_EFFACEE: [
    (state) => ({ type: 'UPDATE_PROPERTY', propertyId: state.mcd.properties[0]!.id, patch: { size: 42 } }),
    (state) => ({ type: 'UPDATE_PROPERTY', propertyId: state.mcd.properties[0]!.id, patch: { size: undefined } }),
  ],
  DELETE_PROPERTY: [(state) => ({ type: 'DELETE_PROPERTY', propertyId: state.mcd.properties[0]!.id })],
  ADD_ATTRIBUTE_ENTITE: [(state) => ({ type: 'ADD_ATTRIBUTE', ownerId: firstEntity(state).id })],
  ADD_ATTRIBUTE_ASSOCIATION: [
    (state) => ({ type: 'ADD_ATTRIBUTE', ownerId: firstAssociation(state).id }),
  ],
  PLACE_PROPERTY: [
    () => ({ type: 'ADD_PROPERTY' }),
    (state) => ({
      type: 'PLACE_PROPERTY',
      ownerId: firstEntity(state).id,
      propertyId: unplacedProperties(state.mcd)[0]!.id,
    }),
  ],
  REMOVE_ATTRIBUTE: [
    (state) => ({
      type: 'REMOVE_ATTRIBUTE',
      ownerId: firstEntity(state).id,
      propertyId: firstEntity(state).attributes[0]!.propertyId,
    }),
  ],
  SET_ATTRIBUTE_IDENTIFIER: [
    (state) => ({
      type: 'SET_ATTRIBUTE_IDENTIFIER',
      entityId: firstEntity(state).id,
      propertyId: firstEntity(state).attributes[0]!.propertyId,
      isIdentifier: false,
    }),
  ],
  SET_LEG_CARDINALITY: [
    (state) => ({ type: 'SET_LEG_CARDINALITY', legId: firstLeg(state).id, cardinality: { min: 0, max: 'n' } }),
  ],
  SET_LEG_ROLE: [(state) => ({ type: 'SET_LEG_ROLE', legId: firstLeg(state).id, role: 'acheteur' })],
  SET_LEG_ROLE_EFFACE: [
    (state) => ({ type: 'SET_LEG_ROLE', legId: firstLeg(state).id, role: 'acheteur' }),
    (state) => ({ type: 'SET_LEG_ROLE', legId: firstLeg(state).id, role: undefined }),
  ],
}

const FIXTURES: Record<string, McdEditorState> = {
  'client et commande': stateOf(clientCommande),
  inscription: stateOf(inscription),
  tutorat: stateOf(tutorat),
  vols: stateOf(vols),
}

describe('document Yjs, chaque action rend ce que rend le réducteur', () => {
  for (const [nom, steps] of Object.entries(SCENARIOS)) {
    for (const [terrain, initial] of Object.entries(FIXTURES)) {
      it(`${nom} sur ${terrain}`, () => {
        expectSameAsReducer(initial, steps)
      })
    }
  }

  it('part aussi d’un modèle vide', () => {
    expectSameAsReducer(EMPTY, [
      () => ({ type: 'ADD_ENTITY', position: { x: 0, y: 0 } }),
      () => ({ type: 'ADD_ASSOCIATION', position: { x: 100, y: 0 } }),
      (state) => ({
        type: 'ADD_LEG',
        associationId: firstAssociation(state).id,
        entityId: firstEntity(state).id,
      }),
      () => ({ type: 'ADD_PROPERTY' }),
    ])
  })
})

/* ------------------------------------------------------------------ */

/** Tirage reproductible, pour que l'essai au hasard soit rejouable. */
function seededRandom(seed: number): () => number {
  let value = seed
  return () => {
    value = (value * 1103515245 + 12345) % 2147483648
    return value / 2147483648
  }
}

/**
 * Une action au hasard, parmi celles que l'état courant rend possibles.
 * Le tirage repart de la graine du pas à chaque appel : rejouer le même
 * pas sur le même état redonne la même action, ce qu'exige la comparaison
 * des deux parcours.
 */
function randomStep(seed: number): Step {
  return (state) => {
    const random = seededRandom(seed)
    const pick = <T,>(items: readonly T[]): T | null =>
      items.length === 0 ? null : (items[Math.floor(random() * items.length)] ?? null)
    const entity = pick(state.mcd.entities)
    const association = pick(state.mcd.associations)
    const leg = association ? pick(association.legs) : null
    const property = pick(state.mcd.properties)
    const unplaced = pick(unplacedProperties(state.mcd))
    const position = { x: Math.floor(random() * 500), y: Math.floor(random() * 500) }

    const candidates: McdAction[] = [
      { type: 'ADD_ENTITY', position },
      { type: 'ADD_ASSOCIATION', position },
      { type: 'ADD_PROPERTY' },
    ]
    if (entity) {
      candidates.push(
        { type: 'RENAME_ENTITY', id: entity.id, name: `E${Math.floor(random() * 10)}` },
        { type: 'MOVE_NODE', id: entity.id, position },
        { type: 'ADD_ATTRIBUTE', ownerId: entity.id },
        { type: 'DELETE_ENTITY', id: entity.id },
      )
      const ref = pick(entity.attributes)
      if (ref) {
        candidates.push(
          { type: 'SET_ATTRIBUTE_IDENTIFIER', entityId: entity.id, propertyId: ref.propertyId, isIdentifier: random() < 0.5 },
          { type: 'REMOVE_ATTRIBUTE', ownerId: entity.id, propertyId: ref.propertyId },
        )
      }
      if (unplaced) {
        candidates.push({ type: 'PLACE_PROPERTY', ownerId: entity.id, propertyId: unplaced.id })
      }
    }
    if (association) {
      candidates.push(
        { type: 'RENAME_ASSOCIATION', id: association.id, name: `A${Math.floor(random() * 10)}` },
        { type: 'MOVE_NODE', id: association.id, position },
        { type: 'ADD_ATTRIBUTE', ownerId: association.id },
        { type: 'DELETE_ASSOCIATION', id: association.id },
      )
      if (entity) {
        candidates.push({ type: 'ADD_LEG', associationId: association.id, entityId: entity.id })
      }
    }
    if (leg) {
      candidates.push(
        { type: 'DELETE_LEG', id: leg.id },
        { type: 'SET_LEG_CARDINALITY', legId: leg.id, cardinality: random() < 0.5 ? { min: 0, max: 'n' } : { min: 1, max: 1 } },
        { type: 'SET_LEG_ROLE', legId: leg.id, role: random() < 0.5 ? 'role' : undefined },
        { type: 'MOVE_NODE', id: leg.id, position },
      )
    }
    if (property) {
      candidates.push(
        { type: 'UPDATE_PROPERTY', propertyId: property.id, patch: { name: `p${Math.floor(random() * 10)}` } },
        { type: 'UPDATE_PROPERTY', propertyId: property.id, patch: { size: random() < 0.5 ? 10 : undefined } },
        { type: 'DELETE_PROPERTY', propertyId: property.id },
      )
    }
    return candidates[Math.floor(random() * candidates.length)]!
  }
}

describe('document Yjs, suites d’actions au hasard', () => {
  for (const seed of [1, 7, 101, 4242, 99_991]) {
    it(`reste identique au réducteur sur 60 actions (graine ${seed})`, () => {
      const steps = Array.from({ length: 60 }, (_, pas) => randomStep(seed * 1000 + pas))
      expectSameAsReducer(stateOf(inscription), steps)
    })
  }
})

/* ------------------------------------------------------------------ */

describe('document Yjs, forme de l’instantané', () => {
  it('se sérialise pareil, qu’il soit construit au départ ou adopté', () => {
    const state = stateOf(inscription)
    const direct = createModelDoc(state)
    const adopte = createModelDoc(EMPTY)
    adopte.adopt(state)

    expect(serialized(adopte.snapshot())).toBe(serialized(direct.snapshot()))
    direct.destroy()
    adopte.destroy()
  })

  it('garde les champs optionnels absents, jamais nuls', () => {
    const doc = createModelDoc(stateOf(clientCommande))
    const snapshot = doc.snapshot()
    const leg = snapshot.mcd.associations[0]!.legs[0]!
    const propriete = snapshot.mcd.properties.find((p) => p.name === 'nom')!

    expect('role' in leg).toBe(false)
    expect('size' in propriete).toBe(false)
    doc.destroy()
  })

  it('garde le rôle et la taille quand ils existent', () => {
    const doc = createModelDoc(stateOf(tutorat))
    expect(doc.snapshot().mcd.associations[0]!.legs[0]!.role).toBe('tuteur')
    doc.destroy()

    const autre = createModelDoc(stateOf(inscription))
    expect(autre.snapshot().mcd.properties.find((p) => p.name === 'codeCours')!.size).toBe(10)
    autre.destroy()
  })

  it('produit un modèle que la relecture de fichier accepte', () => {
    const doc = onDoc(stateOf(tutorat), [
      () => ({ type: 'ADD_ENTITY', position: { x: 1, y: 2 } }),
      (state) => ({ type: 'SET_LEG_ROLE', legId: firstLeg(state).id, role: undefined }),
    ])
    const relu = parseModelFile(serialized(doc.snapshot()))
    expect(relu.ok).toBe(true)
    expect(relu.ok && relu.state).toEqual(doc.snapshot())
    doc.destroy()
  })

  it('n’a que les trois clés attendues sous mcd', () => {
    const doc = createModelDoc(EMPTY)
    expect(Object.keys(doc.snapshot().mcd)).toEqual(['properties', 'entities', 'associations'])
    expect(doc.snapshot().mcd).toEqual({ properties: [], entities: [], associations: [] })
    doc.destroy()
  })
})

describe('document Yjs, identité des deux moitiés', () => {
  it('un déplacement ne touche pas la référence du modèle', () => {
    const doc = createModelDoc(stateOf(clientCommande))
    const avant = doc.snapshot()
    doc.apply({ type: 'MOVE_NODE', id: 'ent-client', position: { x: 99, y: 99 } })
    const apres = doc.snapshot()

    expect(apres.mcd).toBe(avant.mcd)
    expect(apres.layout).not.toBe(avant.layout)
    doc.destroy()
  })

  it('un renommage ne touche pas la référence du layout', () => {
    const doc = createModelDoc(stateOf(clientCommande))
    const avant = doc.snapshot()
    doc.apply({ type: 'RENAME_ENTITY', id: 'ent-client', name: 'Acheteur' })
    const apres = doc.snapshot()

    expect(apres.layout).toBe(avant.layout)
    expect(apres.mcd).not.toBe(avant.mcd)
    doc.destroy()
  })

  it('rend le même instantané tant que rien ne change', () => {
    const doc = createModelDoc(stateOf(clientCommande))
    expect(doc.snapshot()).toBe(doc.snapshot())
    doc.destroy()
  })
})

describe('document Yjs, historique', () => {
  it('fond les renommages successifs d’une même cible en une étape', () => {
    const doc = createModelDoc(stateOf(clientCommande))
    doc.apply({ type: 'RENAME_ENTITY', id: 'ent-client', name: 'A' })
    doc.apply({ type: 'RENAME_ENTITY', id: 'ent-client', name: 'Ac' })
    doc.apply({ type: 'RENAME_ENTITY', id: 'ent-client', name: 'Ach' })

    doc.undo()
    expect(doc.snapshot().mcd.entities.find((e) => e.id === 'ent-client')!.name).toBe('Client')
    expect(doc.canUndo()).toBe(false)
    doc.destroy()
  })

  it('ne fond pas deux cibles différentes', () => {
    const doc = createModelDoc(stateOf(clientCommande))
    doc.apply({ type: 'RENAME_ENTITY', id: 'ent-client', name: 'Acheteur' })
    doc.apply({ type: 'RENAME_ENTITY', id: 'ent-commande', name: 'Achat' })

    doc.undo()
    expect(doc.snapshot().mcd.entities.find((e) => e.id === 'ent-commande')!.name).toBe('Commande')
    expect(doc.snapshot().mcd.entities.find((e) => e.id === 'ent-client')!.name).toBe('Acheteur')
    doc.undo()
    expect(doc.snapshot().mcd.entities.find((e) => e.id === 'ent-client')!.name).toBe('Client')
    doc.destroy()
  })

  it('compte un glisser groupé pour une seule étape, et n’en fond jamais deux', () => {
    const doc = createModelDoc(stateOf(clientCommande))
    doc.apply({
      type: 'MOVE_NODES',
      moves: [
        { id: 'ent-client', position: { x: 1, y: 1 } },
        { id: 'ent-commande', position: { x: 2, y: 2 } },
      ],
    })
    doc.apply({
      type: 'MOVE_NODES',
      moves: [
        { id: 'ent-client', position: { x: 3, y: 3 } },
        { id: 'ent-commande', position: { x: 4, y: 4 } },
      ],
    })

    doc.undo()
    expect(doc.snapshot().layout['ent-client']).toEqual({ x: 1, y: 1 })
    doc.undo()
    expect(doc.snapshot().layout['ent-client']).toEqual(exampleLayout['ent-client'])
    doc.destroy()
  })

  it('n’ouvre aucune étape pour un placement refusé', () => {
    const doc = createModelDoc(stateOf(clientCommande))
    doc.apply({ type: 'RENAME_ENTITY', id: 'ent-client', name: 'Acheteur' })
    // Propriété déjà placée ailleurs : le réducteur refuse en silence.
    const placee = findPlacement(doc.snapshot().mcd, 'prop-num-commande')
    expect(placee).toBeTruthy()
    doc.apply({ type: 'PLACE_PROPERTY', ownerId: 'ent-client', propertyId: 'prop-num-commande' })
    doc.apply({ type: 'PLACE_PROPERTY', ownerId: 'ent-client', propertyId: 'inconnue' })

    doc.undo()
    expect(doc.snapshot()).toEqual(stateOf(clientCommande))
    expect(doc.canUndo()).toBe(false)
    doc.destroy()
  })

  it('rétablit ce qui vient d’être annulé', () => {
    const doc = createModelDoc(stateOf(clientCommande))
    doc.apply({ type: 'ADD_ENTITY', position: { x: 5, y: 5 } })
    const ajoute = doc.snapshot()

    doc.undo()
    expect(doc.snapshot()).toEqual(stateOf(clientCommande))
    expect(doc.canRedo()).toBe(true)

    doc.redo()
    expect(doc.snapshot()).toEqual(ajoute)
    doc.destroy()
  })

  it('garde au plus cent étapes', () => {
    const doc = createModelDoc(stateOf(clientCommande))
    // Cibles alternées : chaque action ouvre bien sa propre étape.
    for (let tour = 0; tour < 120; tour += 1) {
      doc.apply({
        type: 'MOVE_NODE',
        id: tour % 2 === 0 ? 'ent-client' : 'ent-commande',
        position: { x: tour, y: tour },
      })
    }
    for (let tour = 0; tour < 100; tour += 1) {
      doc.undo()
    }
    expect(doc.canUndo()).toBe(false)
    doc.destroy()
  })

  it('adopter remplace le présent et vide l’historique', () => {
    const doc = createModelDoc(stateOf(clientCommande))
    doc.apply({ type: 'RENAME_ENTITY', id: 'ent-client', name: 'Acheteur' })
    expect(doc.canUndo()).toBe(true)

    doc.adopt(stateOf(inscription))
    expect(doc.snapshot()).toEqual(stateOf(inscription))
    expect(doc.canUndo()).toBe(false)
    expect(doc.canRedo()).toBe(false)

    // Une annulation après adoption ne doit rien défaire.
    doc.undo()
    expect(doc.snapshot()).toEqual(stateOf(inscription))
    doc.destroy()
  })

  it('avertit ses abonnés à chaque changement, une fois par action', () => {
    const doc = createModelDoc(stateOf(clientCommande))
    let avis = 0
    const stop = doc.subscribe(() => {
      avis += 1
    })

    doc.apply({ type: 'ADD_ENTITY', position: { x: 1, y: 1 } })
    expect(avis).toBe(1)
    doc.apply({ type: 'MOVE_NODE', id: 'ent-client', position: { x: 2, y: 2 } })
    expect(avis).toBe(2)
    // Action refusée : rien ne change, donc rien à annoncer.
    doc.apply({ type: 'PLACE_PROPERTY', ownerId: 'ent-client', propertyId: 'prop-num-commande' })
    expect(avis).toBe(2)

    stop()
    doc.apply({ type: 'MOVE_NODE', id: 'ent-client', position: { x: 3, y: 3 } })
    expect(avis).toBe(2)
    doc.destroy()
  })
})
