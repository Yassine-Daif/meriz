/**
 * Modèle conceptuel de données (MCD) Merise.
 *
 * Source de vérité unique de l'application. Structure pure :
 * aucune dépendance à React Flow, aucune coordonnée de dessin
 * (les positions vivent dans `layout.ts`). Tout est sérialisable
 * en JSON sans perte.
 *
 * Les invariants de validité sont listés dans `invariants.md`.
 */

/**
 * Vocabulaire fermé des types d'attributs, au niveau conceptuel.
 * Le mapping vers les types SQL se fera plus tard, au niveau MPD.
 * La liste runtime sert aux contrôles d'édition ; le type en dérive,
 * les deux restent donc toujours synchronisés.
 */
export const ATTRIBUTE_TYPES = [
  'texte',
  'entier',
  'decimal',
  'booleen',
  'date',
  'datetime',
  'heure',
] as const

export type AttributeType = (typeof ATTRIBUTE_TYPES)[number]

/**
 * Cardinalité d'une patte : couple (min, max).
 * Seules combinaisons possibles : (0,1), (1,1), (0,n), (1,n).
 */
export interface Cardinality {
  min: 0 | 1
  max: 1 | 'n'
}

/**
 * Propriété du dictionnaire central : un nom et un type conceptuel,
 * définis une seule fois. Les entités et les associations la
 * référencent au lieu de la redéfinir. Une propriété peut exister
 * dans le dictionnaire sans être placée nulle part.
 */
export interface Property {
  id: string
  name: string
  type: AttributeType
  /**
   * Longueur (nombre de caractères), surtout utile pour `texte` :
   * elle dimensionnera le VARCHAR au MPD. Absente = défaut (255).
   */
  size?: number
}

/**
 * Référence d'une propriété placée dans une entité ou une association.
 * Règle d'unicité Merise : une propriété est placée dans au plus un
 * porteur. `isIdentifier` est un rôle du placement, pas une nature de
 * la propriété ; il vaut toujours false côté association.
 * Plusieurs références marquées forment un identifiant composé.
 */
export interface PropertyRef {
  propertyId: string
  isIdentifier: boolean
}

/** Entité : objet du domaine, porte des attributs (références). */
export interface Entity {
  id: string
  name: string
  attributes: PropertyRef[]
}

/**
 * Patte : connexion entre une association et une entité.
 * `role` nomme le rôle joué par l'entité, indispensable pour une
 * association réflexive (plusieurs pattes vers la même entité).
 */
export interface Leg {
  id: string
  entityId: string
  cardinality: Cardinality
  role?: string
}

/**
 * Association : lien entre entités (au moins deux pattes).
 * Peut porter des attributs (`attributes` éventuellement vide).
 */
export interface Association {
  id: string
  name: string
  attributes: PropertyRef[]
  legs: Leg[]
}

/**
 * Racine du modèle : le dictionnaire central des propriétés (liste
 * maîtresse) puis les entités et associations qui les référencent.
 */
export interface Mcd {
  properties: Property[]
  entities: Entity[]
  associations: Association[]
}
