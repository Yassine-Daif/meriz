import type { Leg, Mcd } from './mcd'
import { findProperty, resolveAttributes } from './queries'

/**
 * Un problème du modèle, selon les règles d'invariants.md.
 * Deux niveaux : les erreurs bloquent la génération MLD/MPD/SQL,
 * les avertissements informent sans bloquer.
 * `elementId` pointe l'élément sélectionnable concerné : une entité,
 * une association ou une patte. Pour un problème de propriété ou de
 * référence, c'est l'id du porteur quand il existe (l'unité visible
 * au canvas) ; une propriété non placée n'a pas d'élément cible.
 */
export interface ValidationProblem {
  severity: 'error' | 'warning'
  message: string
  elementId?: string
}

export function validationErrors(problems: ValidationProblem[]): ValidationProblem[] {
  return problems.filter((p) => p.severity === 'error')
}

export function validationWarnings(problems: ValidationProblem[]): ValidationProblem[] {
  return problems.filter((p) => p.severity === 'warning')
}

/** Nom affichable dans un message, même quand il est vide. */
function displayName(name: string): string {
  return name.trim() === '' ? '(sans nom)' : name.trim()
}

/** Mots réservés SQL courants (MySQL et PostgreSQL confondus). */
const SQL_RESERVED_WORDS = new Set(
  [
    'add', 'all', 'alter', 'and', 'as', 'asc', 'between', 'by', 'case', 'check',
    'column', 'constraint', 'create', 'cross', 'current_date', 'current_time',
    'database', 'date', 'default', 'delete', 'desc', 'distinct', 'drop', 'else',
    'end', 'exists', 'foreign', 'from', 'group', 'having', 'in', 'index', 'inner',
    'insert', 'int', 'integer', 'into', 'is', 'join', 'key', 'left', 'like',
    'limit', 'not', 'null', 'on', 'or', 'order', 'outer', 'primary', 'references',
    'right', 'select', 'set', 'table', 'then', 'time', 'timestamp', 'to', 'union',
    'unique', 'update', 'user', 'using', 'values', 'when', 'where',
  ],
)

/**
 * Vérifie le modèle et retourne erreurs et avertissements, en français
 * clair. Aucune erreur = le modèle est prêt à être transformé.
 * (L'invariant sur les cardinalités est garanti par le type
 * `Cardinality` et revérifié à l'import JSON dans persistence.ts.)
 */
export function validate(mcd: Mcd): ValidationProblem[] {
  const problems: ValidationProblem[] = []
  const error = (message: string, elementId?: string) =>
    problems.push({ severity: 'error', message, elementId })
  const warning = (message: string, elementId?: string) =>
    problems.push({ severity: 'warning', message, elementId })

  /* ----------------------------- Erreurs ----------------------------- */

  // Unicité de tous les ids techniques.
  const seenIds = new Set<string>()
  const allIds: string[] = [...mcd.properties.map((p) => p.id)]
  for (const entity of mcd.entities) {
    allIds.push(entity.id)
  }
  for (const association of mcd.associations) {
    allIds.push(association.id, ...association.legs.map((l) => l.id))
  }
  for (const id of allIds) {
    if (seenIds.has(id)) {
      error(`Identifiant technique utilisé plusieurs fois : « ${id} ».`)
    }
    seenIds.add(id)
  }

  // Dictionnaire : noms de propriétés non vides et uniques.
  const seenPropertyNames = new Set<string>()
  for (const property of mcd.properties) {
    const name = property.name.trim()
    if (name === '') {
      error("Une propriété du dictionnaire n'a pas de nom.")
      continue
    }
    const key = name.toLowerCase()
    if (seenPropertyNames.has(key)) {
      error(`Deux propriétés du dictionnaire portent le même nom « ${name} ».`)
    }
    seenPropertyNames.add(key)
  }

  // Règle d'unicité Merise : une propriété placée dans au plus un
  // porteur, et au plus une fois. On compte tous les placements.
  const placements = new Map<string, string[]>()
  const owners = [
    ...mcd.entities.map((e) => ({
      id: e.id,
      label: `l'entité ${displayName(e.name)}`,
      refs: e.attributes,
    })),
    ...mcd.associations.map((a) => ({
      id: a.id,
      label: `l'association ${displayName(a.name)}`,
      refs: a.attributes,
    })),
  ]
  for (const owner of owners) {
    for (const ref of owner.refs) {
      if (!findProperty(mcd, ref.propertyId)) {
        error(`Dans ${owner.label}, un attribut référence une propriété inexistante.`, owner.id)
        continue
      }
      const list = placements.get(ref.propertyId)
      if (list) {
        list.push(owner.id)
      } else {
        placements.set(ref.propertyId, [owner.id])
      }
    }
  }
  for (const [propertyId, ownerIds] of placements) {
    if (ownerIds.length > 1) {
      const property = findProperty(mcd, propertyId)
      error(
        `La propriété « ${displayName(property?.name ?? propertyId)} » est placée plusieurs fois : une propriété appartient à au plus une entité ou association.`,
        ownerIds[1],
      )
    }
  }

  // Entités.
  const seenEntityNames = new Set<string>()
  for (const entity of mcd.entities) {
    const name = entity.name.trim()
    if (name === '') {
      error("Une entité n'a pas de nom.", entity.id)
    } else {
      const key = name.toLowerCase()
      if (seenEntityNames.has(key)) {
        error(`Deux entités portent le même nom « ${name} ».`, entity.id)
      }
      seenEntityNames.add(key)
    }

    if (entity.attributes.length === 0) {
      error(`L'entité ${displayName(entity.name)} n'a aucun attribut.`, entity.id)
    } else if (!entity.attributes.some((ref) => ref.isIdentifier)) {
      error(`L'entité ${displayName(entity.name)} n'a pas d'identifiant.`, entity.id)
    }
  }

  // Associations et pattes.
  const entityIds = new Set(mcd.entities.map((e) => e.id))
  const seenAssociationNames = new Set<string>()
  for (const association of mcd.associations) {
    const name = association.name.trim()
    const label = displayName(association.name)

    if (name === '') {
      error("Une association n'a pas de nom.", association.id)
    } else {
      const key = name.toLowerCase()
      if (seenAssociationNames.has(key)) {
        error(`Deux associations portent le même nom « ${name} ».`, association.id)
      }
      seenAssociationNames.add(key)
    }

    if (association.legs.length < 2) {
      error(`L'association ${label} doit relier au moins deux entités.`, association.id)
    }

    for (const ref of association.attributes) {
      if (ref.isIdentifier) {
        const property = findProperty(mcd, ref.propertyId)
        error(
          `L'attribut « ${displayName(property?.name ?? ref.propertyId)} » de l'association ${label} ne peut pas être identifiant.`,
          association.id,
        )
      }
    }

    // Chaque patte pointe vers une entité existante.
    const legsByEntity = new Map<string, Leg[]>()
    for (const leg of association.legs) {
      if (!entityIds.has(leg.entityId)) {
        error(`Une patte de l'association ${label} pointe vers une entité inexistante.`, leg.id)
        continue
      }
      const group = legsByEntity.get(leg.entityId)
      if (group) {
        group.push(leg)
      } else {
        legsByEntity.set(leg.entityId, [leg])
      }
    }

    // Réflexif → rôles obligatoires et distincts.
    for (const [entityId, legs] of legsByEntity) {
      if (legs.length < 2) {
        continue
      }
      const roles = legs.map((l) => l.role?.trim() ?? '')
      const rolesAreDistinct =
        !roles.includes('') && new Set(roles.map((r) => r.toLowerCase())).size === roles.length
      if (!rolesAreDistinct) {
        const entityName = mcd.entities.find((e) => e.id === entityId)?.name ?? entityId
        error(
          `Les pattes de l'association ${label} vers l'entité ${displayName(entityName)} doivent chacune porter un rôle, et des rôles distincts.`,
          association.id,
        )
      }
    }
  }

  /* -------------------------- Avertissements -------------------------- */

  // Entité isolée : reliée à aucune association.
  const linkedEntityIds = new Set(
    mcd.associations.flatMap((a) => a.legs.map((l) => l.entityId)),
  )
  for (const entity of mcd.entities) {
    if (!linkedEntityIds.has(entity.id)) {
      warning(
        `L'entité ${displayName(entity.name)} est isolée : elle n'est reliée à aucune association.`,
        entity.id,
      )
    }
  }

  // Noms qui sont des mots réservés SQL.
  const named: { label: string; name: string; elementId?: string }[] = [
    ...mcd.entities.map((e) => ({ label: "l'entité", name: e.name, elementId: e.id })),
    ...mcd.associations.map((a) => ({ label: "l'association", name: a.name, elementId: a.id })),
    ...mcd.properties.map((p) => ({
      label: 'la propriété',
      name: p.name,
      elementId: findPlacementOwnerId(mcd, p.id),
    })),
  ]
  for (const item of named) {
    const word = item.name.trim().toLowerCase()
    if (SQL_RESERVED_WORDS.has(word)) {
      warning(
        `Le nom de ${item.label} « ${item.name.trim()} » est un mot réservé SQL (${word.toUpperCase()}) : il devra être renommé ou échappé.`,
        item.elementId,
      )
    }
  }

  for (const association of mcd.associations) {
    const label = displayName(association.name)
    const legs = association.legs.filter((l) => entityIds.has(l.entityId))

    // Binaire un à un : le sens de la clé étrangère suivra la
    // convention (côté minimum 1, sinon première patte).
    if (legs.length === 2 && legs.every((l) => l.cardinality.max === 1)) {
      warning(
        `L'association ${label} est un « un à un » (deux pattes à maximum 1) : la clé étrangère ira du côté de cardinalité (1,1), ou du premier côté si les minima sont égaux.`,
        association.id,
      )
    }

    // Ternaire et plus : deviendra une table de liaison.
    if (legs.length >= 3) {
      warning(
        `L'association ${label} relie ${legs.length} entités : elle deviendra une table de liaison à clé primaire composée.`,
        association.id,
      )
    }

    // Collision de colonne après migration de clé (règle 2) : la PK de
    // l'entité visée porte le même nom qu'une propriété déjà présente
    // chez le porteur de la clé étrangère.
    if (legs.length === 2 && legs.some((l) => l.cardinality.max === 1)) {
      const [a, b] = legs as [Leg, Leg]
      const maxOne = legs.filter((l) => l.cardinality.max === 1)
      const fkLeg = maxOne.length === 2 ? (maxOne.find((l) => l.cardinality.min === 1) ?? maxOne[0]!) : maxOne[0]!
      const targetLeg = fkLeg === a ? b : a
      if (fkLeg.role?.trim() || targetLeg.role?.trim()) {
        continue // le rôle préfixera la colonne, pas de collision
      }
      const holder = mcd.entities.find((e) => e.id === fkLeg.entityId)
      const target = mcd.entities.find((e) => e.id === targetLeg.entityId)
      if (!holder || !target) {
        continue
      }
      const holderNames = new Set(
        resolveAttributes(mcd, holder.attributes).map((attr) => attr.name.toLowerCase()),
      )
      for (const pk of resolveAttributes(mcd, target.attributes).filter((x) => x.isIdentifier)) {
        if (holderNames.has(pk.name.toLowerCase())) {
          warning(
            `Après migration de clé, la colonne « ${pk.name} » (clé de ${displayName(target.name)}) entrera en collision avec une propriété de ${displayName(holder.name)} : elle sera renommée automatiquement.`,
            association.id,
          )
        }
      }
    }
  }

  return problems
}

/** Porteur éventuel d'une propriété, pour rendre un problème cliquable. */
function findPlacementOwnerId(mcd: Mcd, propertyId: string): string | undefined {
  for (const entity of mcd.entities) {
    if (entity.attributes.some((ref) => ref.propertyId === propertyId)) {
      return entity.id
    }
  }
  for (const association of mcd.associations) {
    if (association.attributes.some((ref) => ref.propertyId === propertyId)) {
      return association.id
    }
  }
  return undefined
}
