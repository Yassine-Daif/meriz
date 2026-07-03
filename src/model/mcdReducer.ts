import type {
  Association,
  PropertyRef,
  AttributeType,
  Cardinality,
  Entity,
  Leg,
  Mcd,
  Property,
} from './mcd'
import type { McdLayout, Position } from './layout'
import { findPlacement, findProperty } from './queries'
import { newId } from '../lib/id'

/**
 * État applicatif : le MCD (source de vérité) et le layout (positions).
 * Toute action utilisateur passe par ce reducer pur ; l'affichage
 * React Flow est ensuite recalculé à partir de cet état.
 */
export interface McdEditorState {
  mcd: Mcd
  layout: McdLayout
}

/** Modification partielle d'une propriété du dictionnaire. */
export interface PropertyPatch {
  name?: string
  type?: AttributeType
  size?: number | undefined
}

export type McdAction =
  | { type: 'ADD_ENTITY'; position: Position }
  | { type: 'ADD_ASSOCIATION'; position: Position }
  | { type: 'ADD_LEG'; associationId: string; entityId: string }
  | { type: 'MOVE_NODE'; id: string; position: Position }
  | { type: 'MOVE_NODES'; moves: { id: string; position: Position }[] }
  | { type: 'DELETE_ENTITY'; id: string }
  | { type: 'DELETE_ASSOCIATION'; id: string }
  | { type: 'DELETE_LEG'; id: string }
  | { type: 'RENAME_ENTITY'; id: string; name: string }
  | { type: 'RENAME_ASSOCIATION'; id: string; name: string }
  // Dictionnaire central : la propriété est définie une seule fois.
  | { type: 'ADD_PROPERTY' }
  | { type: 'UPDATE_PROPERTY'; propertyId: string; patch: PropertyPatch }
  | { type: 'DELETE_PROPERTY'; propertyId: string }
  // Placements : une propriété dans au plus un porteur.
  | { type: 'ADD_ATTRIBUTE'; ownerId: string }
  | { type: 'PLACE_PROPERTY'; ownerId: string; propertyId: string }
  | { type: 'REMOVE_ATTRIBUTE'; ownerId: string; propertyId: string }
  | { type: 'SET_ATTRIBUTE_IDENTIFIER'; entityId: string; propertyId: string; isIdentifier: boolean }
  | { type: 'SET_LEG_CARDINALITY'; legId: string; cardinality: Cardinality }
  | { type: 'SET_LEG_ROLE'; legId: string; role: string | undefined }
  | { type: 'LOAD_MODEL'; mcd: Mcd; layout: McdLayout }
  | { type: 'NEW_MODEL' }

/** Premier nom « base N » non encore utilisé. */
function nextName(base: string, usedNames: string[]): string {
  let n = 1
  while (usedNames.includes(`${base} ${n}`)) {
    n += 1
  }
  return `${base} ${n}`
}

/** Nouvelle propriété au nom unique dans le dictionnaire. */
function newProperty(mcd: Mcd, base: string, type: AttributeType): Property {
  return {
    id: newId(),
    name: nextName(
      base,
      mcd.properties.map((p) => p.name),
    ),
    type,
  }
}

function withEntity(
  state: McdEditorState,
  id: string,
  update: (entity: Entity) => Entity,
): McdEditorState {
  return {
    ...state,
    mcd: {
      ...state.mcd,
      entities: state.mcd.entities.map((e) => (e.id === id ? update(e) : e)),
    },
  }
}

function withAssociation(
  state: McdEditorState,
  id: string,
  update: (association: Association) => Association,
): McdEditorState {
  return {
    ...state,
    mcd: {
      ...state.mcd,
      associations: state.mcd.associations.map((a) => (a.id === id ? update(a) : a)),
    },
  }
}

/** Applique une transformation aux références du porteur (entité ou association). */
function withOwnerAttributes(
  state: McdEditorState,
  ownerId: string,
  update: (attributes: PropertyRef[]) => PropertyRef[],
): McdEditorState {
  if (state.mcd.entities.some((e) => e.id === ownerId)) {
    return withEntity(state, ownerId, (e) => ({ ...e, attributes: update(e.attributes) }))
  }
  return withAssociation(state, ownerId, (a) => ({ ...a, attributes: update(a.attributes) }))
}

function withLeg(
  state: McdEditorState,
  legId: string,
  update: (leg: Leg) => Leg,
): McdEditorState {
  return {
    ...state,
    mcd: {
      ...state.mcd,
      associations: state.mcd.associations.map((a) =>
        a.legs.some((l) => l.id === legId)
          ? { ...a, legs: a.legs.map((l) => (l.id === legId ? update(l) : l)) }
          : a,
      ),
    },
  }
}

export function mcdReducer(state: McdEditorState, action: McdAction): McdEditorState {
  switch (action.type) {
    case 'ADD_ENTITY': {
      // Une entité naît avec une propriété identifiant placée, pour
      // respecter les invariants (au moins un attribut, un identifiant).
      const property = newProperty(state.mcd, 'id', 'entier')
      const entity: Entity = {
        id: newId(),
        name: nextName(
          'Entite',
          state.mcd.entities.map((e) => e.name),
        ),
        attributes: [{ propertyId: property.id, isIdentifier: true }],
      }
      return {
        mcd: {
          ...state.mcd,
          properties: [...state.mcd.properties, property],
          entities: [...state.mcd.entities, entity],
        },
        layout: { ...state.layout, [entity.id]: action.position },
      }
    }

    case 'ADD_ASSOCIATION': {
      const association: Association = {
        id: newId(),
        name: nextName(
          'Association',
          state.mcd.associations.map((a) => a.name),
        ),
        attributes: [],
        legs: [],
      }
      return {
        mcd: { ...state.mcd, associations: [...state.mcd.associations, association] },
        layout: { ...state.layout, [association.id]: action.position },
      }
    }

    case 'ADD_LEG': {
      // Cardinalité par défaut (1,1), éditable dans l'inspecteur.
      return {
        ...state,
        mcd: {
          ...state.mcd,
          associations: state.mcd.associations.map((a) =>
            a.id === action.associationId
              ? {
                  ...a,
                  legs: [
                    ...a.legs,
                    {
                      id: newId(),
                      entityId: action.entityId,
                      cardinality: { min: 1, max: 1 },
                    },
                  ],
                }
              : a,
          ),
        },
      }
    }

    case 'MOVE_NODE': {
      // Le déplacement ne touche que le layout, jamais le modèle.
      return {
        ...state,
        layout: { ...state.layout, [action.id]: action.position },
      }
    }

    case 'MOVE_NODES': {
      // Glisser groupé : une seule action, donc une seule étape d'undo.
      const layout = { ...state.layout }
      for (const move of action.moves) {
        layout[move.id] = move.position
      }
      return { ...state, layout }
    }

    case 'DELETE_ENTITY': {
      // Retire aussi les pattes qui référencent l'entité (pas de lien
      // orphelin). Ses propriétés restent au dictionnaire, non placées.
      const layout = { ...state.layout }
      delete layout[action.id]
      // Les positions d'étiquettes des pattes supprimées partent aussi.
      for (const association of state.mcd.associations) {
        for (const leg of association.legs) {
          if (leg.entityId === action.id) {
            delete layout[leg.id]
          }
        }
      }
      return {
        mcd: {
          ...state.mcd,
          entities: state.mcd.entities.filter((e) => e.id !== action.id),
          associations: state.mcd.associations.map((a) =>
            a.legs.some((l) => l.entityId === action.id)
              ? { ...a, legs: a.legs.filter((l) => l.entityId !== action.id) }
              : a,
          ),
        },
        layout,
      }
    }

    case 'DELETE_ASSOCIATION': {
      const layout = { ...state.layout }
      delete layout[action.id]
      const association = state.mcd.associations.find((a) => a.id === action.id)
      for (const leg of association?.legs ?? []) {
        delete layout[leg.id]
      }
      return {
        mcd: {
          ...state.mcd,
          associations: state.mcd.associations.filter((a) => a.id !== action.id),
        },
        layout,
      }
    }

    case 'DELETE_LEG': {
      const layout = { ...state.layout }
      delete layout[action.id]
      return {
        mcd: {
          ...state.mcd,
          associations: state.mcd.associations.map((a) =>
            a.legs.some((l) => l.id === action.id)
              ? { ...a, legs: a.legs.filter((l) => l.id !== action.id) }
              : a,
          ),
        },
        layout,
      }
    }

    case 'RENAME_ENTITY': {
      return withEntity(state, action.id, (e) => ({ ...e, name: action.name }))
    }

    case 'RENAME_ASSOCIATION': {
      return withAssociation(state, action.id, (a) => ({ ...a, name: action.name }))
    }

    case 'ADD_PROPERTY': {
      return {
        ...state,
        mcd: {
          ...state.mcd,
          properties: [...state.mcd.properties, newProperty(state.mcd, 'propriete', 'texte')],
        },
      }
    }

    case 'UPDATE_PROPERTY': {
      return {
        ...state,
        mcd: {
          ...state.mcd,
          properties: state.mcd.properties.map((p) =>
            p.id === action.propertyId ? { ...p, ...action.patch } : p,
          ),
        },
      }
    }

    case 'DELETE_PROPERTY': {
      // Suppression définitive : la propriété quitte le dictionnaire
      // et son placement éventuel disparaît avec elle.
      const dropRef = (refs: PropertyRef[]) =>
        refs.filter((ref) => ref.propertyId !== action.propertyId)
      return {
        ...state,
        mcd: {
          properties: state.mcd.properties.filter((p) => p.id !== action.propertyId),
          entities: state.mcd.entities.map((e) => ({ ...e, attributes: dropRef(e.attributes) })),
          associations: state.mcd.associations.map((a) => ({
            ...a,
            attributes: dropRef(a.attributes),
          })),
        },
      }
    }

    case 'ADD_ATTRIBUTE': {
      // Crée une propriété au dictionnaire et la place dans le porteur.
      const property = newProperty(state.mcd, 'propriete', 'texte')
      const placed = withOwnerAttributes(
        { ...state, mcd: { ...state.mcd, properties: [...state.mcd.properties, property] } },
        action.ownerId,
        (attributes) => [...attributes, { propertyId: property.id, isIdentifier: false }],
      )
      return placed
    }

    case 'PLACE_PROPERTY': {
      // Unicité par construction : refus silencieux si la propriété
      // n'existe pas ou est déjà placée quelque part.
      if (
        !findProperty(state.mcd, action.propertyId) ||
        findPlacement(state.mcd, action.propertyId)
      ) {
        return state
      }
      return withOwnerAttributes(state, action.ownerId, (attributes) => [
        ...attributes,
        { propertyId: action.propertyId, isIdentifier: false },
      ])
    }

    case 'REMOVE_ATTRIBUTE': {
      // Retire le placement ; la propriété reste au dictionnaire.
      return withOwnerAttributes(state, action.ownerId, (attributes) =>
        attributes.filter((ref) => ref.propertyId !== action.propertyId),
      )
    }

    case 'SET_ATTRIBUTE_IDENTIFIER': {
      return withEntity(state, action.entityId, (e) => ({
        ...e,
        attributes: e.attributes.map((ref) =>
          ref.propertyId === action.propertyId
            ? { ...ref, isIdentifier: action.isIdentifier }
            : ref,
        ),
      }))
    }

    case 'SET_LEG_CARDINALITY': {
      return withLeg(state, action.legId, (l) => ({ ...l, cardinality: action.cardinality }))
    }

    case 'SET_LEG_ROLE': {
      return withLeg(state, action.legId, (l) => ({ ...l, role: action.role }))
    }

    case 'LOAD_MODEL': {
      // Remplacement complet de l'état, après contrôle de forme
      // effectué en amont (persistence.ts).
      return { mcd: action.mcd, layout: action.layout }
    }

    case 'NEW_MODEL': {
      return { mcd: { properties: [], entities: [], associations: [] }, layout: {} }
    }
  }
}
