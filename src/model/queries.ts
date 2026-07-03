import type {
  Association,
  PropertyRef,
  AttributeType,
  Entity,
  Leg,
  Mcd,
  Property,
} from './mcd'

/** Lectures pures du modèle, partagées par l'interface et la validation. */

/** Attribut résolu : la référence jointe à sa propriété du dictionnaire. */
export interface ResolvedAttribute {
  propertyId: string
  name: string
  type: AttributeType
  size?: number
  isIdentifier: boolean
}

/** Porteur d'une propriété placée : entité ou association. */
export type Placement =
  | { kind: 'entity'; owner: Entity }
  | { kind: 'association'; owner: Association }

export function findEntity(mcd: Mcd, id: string): Entity | undefined {
  return mcd.entities.find((entity) => entity.id === id)
}

export function findAssociation(mcd: Mcd, id: string): Association | undefined {
  return mcd.associations.find((association) => association.id === id)
}

export function findProperty(mcd: Mcd, id: string): Property | undefined {
  return mcd.properties.find((property) => property.id === id)
}

/** Retrouve une patte et l'association qui la porte. */
export function findLeg(
  mcd: Mcd,
  legId: string,
): { association: Association; leg: Leg } | undefined {
  for (const association of mcd.associations) {
    const leg = association.legs.find((l) => l.id === legId)
    if (leg) {
      return { association, leg }
    }
  }
  return undefined
}

/**
 * Résout des références d'attributs vers leurs propriétés. Une
 * référence vers une propriété inexistante est ignorée ici : c'est
 * la validation qui la signale.
 */
export function resolveAttributes(mcd: Mcd, refs: PropertyRef[]): ResolvedAttribute[] {
  const resolved: ResolvedAttribute[] = []
  for (const ref of refs) {
    const property = findProperty(mcd, ref.propertyId)
    if (property) {
      resolved.push({
        propertyId: property.id,
        name: property.name,
        type: property.type,
        size: property.size,
        isIdentifier: ref.isIdentifier,
      })
    }
  }
  return resolved
}

/** Où une propriété est-elle placée ? Au plus un porteur si le modèle est valide. */
export function findPlacement(mcd: Mcd, propertyId: string): Placement | undefined {
  for (const entity of mcd.entities) {
    if (entity.attributes.some((ref) => ref.propertyId === propertyId)) {
      return { kind: 'entity', owner: entity }
    }
  }
  for (const association of mcd.associations) {
    if (association.attributes.some((ref) => ref.propertyId === propertyId)) {
      return { kind: 'association', owner: association }
    }
  }
  return undefined
}

/** Propriétés du dictionnaire qui ne sont placées nulle part. */
export function unplacedProperties(mcd: Mcd): Property[] {
  const placed = new Set<string>()
  for (const entity of mcd.entities) {
    for (const ref of entity.attributes) {
      placed.add(ref.propertyId)
    }
  }
  for (const association of mcd.associations) {
    for (const ref of association.attributes) {
      placed.add(ref.propertyId)
    }
  }
  return mcd.properties.filter((property) => !placed.has(property.id))
}
