import { t } from "../i18n/runtime"
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
  return name.trim() === '' ? t("(sans nom)") : name.trim()
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
      error(t("Identifiant technique utilisé plusieurs fois : « {0} ».", [id]))
    }
    seenIds.add(id)
  }

  // Dictionnaire : noms de propriétés non vides et uniques.
  const seenPropertyNames = new Set<string>()
  for (const property of mcd.properties) {
    const name = property.name.trim()
    if (name === '') {
      error(t("Une propriété du dictionnaire n'a pas de nom."))
      continue
    }
    const key = name.toLowerCase()
    if (seenPropertyNames.has(key)) {
      error(t("Deux propriétés du dictionnaire portent le même nom « {0} ».", [name]))
    }
    seenPropertyNames.add(key)
  }

  // Règle d'unicité Merise : une propriété placée dans au plus un
  // porteur, et au plus une fois. On compte tous les placements.
  const placements = new Map<string, string[]>()
  const owners = [
    ...mcd.entities.map((e) => ({
      id: e.id,
      label: t("l'entité {0}", [displayName(e.name)]),
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
        error(t("Dans {0}, un attribut référence une propriété inexistante.", [owner.label]), owner.id)
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
        t("La propriété « {0} » est placée plusieurs fois : une propriété appartient à au plus une entité ou association.", [displayName(property?.name ?? propertyId)]),
        ownerIds[1],
      )
    }
  }

  // Entités.
  const seenEntityNames = new Set<string>()
  for (const entity of mcd.entities) {
    const name = entity.name.trim()
    if (name === '') {
      error(t("Une entité n'a pas de nom."), entity.id)
    } else {
      const key = name.toLowerCase()
      if (seenEntityNames.has(key)) {
        error(t("Deux entités portent le même nom « {0} ».", [name]), entity.id)
      }
      seenEntityNames.add(key)
    }

    if (entity.attributes.length === 0) {
      error(t("L'entité {0} n'a aucun attribut.", [displayName(entity.name)]), entity.id)
    } else if (!entity.attributes.some((ref) => ref.isIdentifier)) {
      error(t("L'entité {0} n'a pas d'identifiant.", [displayName(entity.name)]), entity.id)
    }
  }

  // Associations et pattes.
  const entityIds = new Set(mcd.entities.map((e) => e.id))
  const seenAssociationNames = new Set<string>()
  for (const association of mcd.associations) {
    const name = association.name.trim()
    const label = displayName(association.name)

    if (name === '') {
      error(t("Une association n'a pas de nom."), association.id)
    } else {
      const key = name.toLowerCase()
      if (seenAssociationNames.has(key)) {
        error(t("Deux associations portent le même nom « {0} ».", [name]), association.id)
      }
      seenAssociationNames.add(key)
    }

    if (association.legs.length < 2) {
      error(t("L'association {0} doit relier au moins deux entités.", [label]), association.id)
    }

    for (const ref of association.attributes) {
      if (ref.isIdentifier) {
        const property = findProperty(mcd, ref.propertyId)
        error(
          t("L'attribut « {0} » de l'association {1} ne peut pas être identifiant.", [displayName(property?.name ?? ref.propertyId), label]),
          association.id,
        )
      }
    }

    // Chaque patte pointe vers une entité existante.
    const legsByEntity = new Map<string, Leg[]>()
    for (const leg of association.legs) {
      if (!entityIds.has(leg.entityId)) {
        error(t("Une patte de l'association {0} pointe vers une entité inexistante.", [label]), leg.id)
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
          t("Les pattes de l'association {0} vers l'entité {1} doivent chacune porter un rôle, et des rôles distincts.", [label, displayName(entityName)]),
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
        t("L'entité {0} est isolée : elle n'est reliée à aucune association.", [displayName(entity.name)]),
        entity.id,
      )
    }
  }

  // Noms qui sont des mots réservés SQL.
  const named: { label: string; name: string; elementId?: string }[] = [
    ...mcd.entities.map((e) => ({ label: t("l'entité"), name: e.name, elementId: e.id })),
    ...mcd.associations.map((a) => ({ label: t("l'association"), name: a.name, elementId: a.id })),
    ...mcd.properties.map((p) => ({
      label: t("la propriété"),
      name: p.name,
      elementId: findPlacementOwnerId(mcd, p.id),
    })),
  ]
  for (const item of named) {
    const word = item.name.trim().toLowerCase()
    if (SQL_RESERVED_WORDS.has(word)) {
      warning(
        t("Le nom de {0} « {1} » est un mot réservé SQL ({2}) : il devra être renommé ou échappé.", [item.label, item.name.trim(), word.toUpperCase()]),
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
        t("L'association {0} est un « un à un » (deux pattes à maximum 1) : la clé étrangère ira du côté de cardinalité (1,1), ou du premier côté si les minima sont égaux.", [label]),
        association.id,
      )
    }

    // Ternaire et plus : deviendra une table de liaison.
    if (legs.length >= 3) {
      warning(
        t("L'association {0} relie {1} entités : elle deviendra une table de liaison à clé primaire composée.", [label, legs.length]),
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
            t("Après migration de clé, la colonne « {0} » (clé de {1}) entrera en collision avec une propriété de {2} : elle sera renommée automatiquement.", [pk.name, displayName(target.name), displayName(holder.name)]),
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
