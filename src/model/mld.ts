import type { AttributeType, Association, Mcd } from './mcd'
import { resolveAttributes } from './queries'

/**
 * MLD : modèle logique de données, dérivé du MCD par les règles de
 * passage Merise. Structure pure, types conceptuels seulement, le
 * passage aux types SQL se fait au MPD (sql.ts).
 */

export interface MldReference {
  tableId: string
  tableName: string
  /** Colonne cible dans la table référencée. */
  columnName: string
  /** Groupe de clé étrangère (une patte = un groupe), pour les FK composées. */
  group: string
}

export interface MldColumn {
  id: string
  name: string
  type: AttributeType
  /** Longueur héritée de la propriété (les FK héritent de la PK visée). */
  size?: number
  isPrimaryKey: boolean
  nullable: boolean
  references?: MldReference
}

export interface MldTable {
  id: string
  name: string
  columns: MldColumn[]
}

/**
 * Notation relationnelle textuelle d'une table (le MLDR d'AnalyseSI) :
 * `Client (numeroClient, nom)`, clés étrangères préfixées `#`.
 */
export function relationalLine(table: MldTable): string {
  const columns = table.columns
    .map((column) => `${column.references ? '#' : ''}${column.name}`)
    .join(', ')
  return `${table.name} (${columns})`
}

/** Premier nom libre : « base », puis « base2 », « base3»… */
function uniqueName(base: string, used: Set<string>): string {
  let candidate = base
  let n = 2
  while (used.has(candidate.toLowerCase())) {
    candidate = `${base}${n}`
    n += 1
  }
  used.add(candidate.toLowerCase())
  return candidate
}

/**
 * Règles de passage MCD → MLD :
 * 1. Entité → table, références identifiantes → clé primaire.
 * 2. Association binaire dont une patte a max = 1 → clé étrangère dans
 *    la table de cette patte (la cardinalité se lit depuis l'entité :
 *    max = 1 signifie « une seule occurrence en face », la clé va là).
 *    NOT NULL si min = 1. Les attributs portés migrent dans cette table.
 *    Si les deux pattes ont max = 1, la patte (1,1) est prioritaire.
 * 3. Tout autre cas (toutes pattes max = n, ternaire et plus) → table
 *    de jonction : clé primaire composée des clés des entités reliées,
 *    plus les attributs portés. En réflexif, le rôle préfixe la colonne.
 *
 * À appeler sur un modèle valide (validate.ts) : les pattes vers des
 * entités inexistantes sont ignorées silencieusement ici.
 */
export function mcdToMld(mcd: Mcd): MldTable[] {
  // Tables d'entités, et index de leurs clés primaires.
  const tables = new Map<string, MldTable>()
  const primaryKeys = new Map<string, MldColumn[]>()

  for (const entity of mcd.entities) {
    const usedColumnNames = new Set<string>()
    const columns: MldColumn[] = resolveAttributes(mcd, entity.attributes).map((attribute) => ({
      id: attribute.propertyId,
      name: uniqueName(attribute.name, usedColumnNames),
      type: attribute.type,
      size: attribute.size,
      isPrimaryKey: attribute.isIdentifier,
      nullable: false,
    }))
    const table: MldTable = { id: entity.id, name: entity.name, columns }
    tables.set(entity.id, table)
    primaryKeys.set(
      entity.id,
      columns.filter((c) => c.isPrimaryKey),
    )
  }

  const junctionTables: MldTable[] = []

  for (const association of mcd.associations) {
    const legs = association.legs.filter((leg) => tables.has(leg.entityId))
    if (legs.length < 2) {
      continue
    }

    const attributes = resolveAttributes(mcd, association.attributes)

    // Règle 2 : binaire avec une patte à max = 1 → clé étrangère.
    if (legs.length === 2 && legs.some((leg) => leg.cardinality.max === 1)) {
      const [a, b] = legs as [typeof legs[0], typeof legs[0]]
      // Convention un à un : la clé va du côté à minimum 1 (pas de
      // valeur nulle) ; à minima égaux, la première patte la reçoit
      // (choix déterministe, signalé par un avertissement).
      const maxOneLegs = legs.filter((leg) => leg.cardinality.max === 1)
      const fkLeg =
        maxOneLegs.length === 2
          ? (maxOneLegs.find((leg) => leg.cardinality.min === 1) ?? maxOneLegs[0]!)
          : maxOneLegs[0]!
      const targetLeg = fkLeg === a ? b : a
      const holder = tables.get(fkLeg.entityId)!
      const target = tables.get(targetLeg.entityId)!
      const targetPk = primaryKeys.get(targetLeg.entityId) ?? []
      const usedNames = new Set(holder.columns.map((c) => c.name.toLowerCase()))
      const nullable = fkLeg.cardinality.min === 0

      for (const pk of targetPk) {
        // La colonne pointe vers l'entité de la patte visée : c'est
        // son rôle qui la nomme (réflexif : « tuteur_numeroEtudiant »).
        // En collision avec une colonne existante, le nom de l'entité
        // visée préfixe la colonne avant tout suffixe numérique.
        const rolePrefix = targetLeg.role?.trim() || fkLeg.role?.trim()
        let base = rolePrefix ? `${rolePrefix}_${pk.name}` : pk.name
        if (!rolePrefix && usedNames.has(base.toLowerCase())) {
          base = `${target.name}_${pk.name}`
        }
        holder.columns.push({
          id: `${fkLeg.id}:${pk.id}`,
          name: uniqueName(base, usedNames),
          type: pk.type,
          size: pk.size,
          isPrimaryKey: false,
          nullable,
          references: {
            tableId: target.id,
            tableName: target.name,
            columnName: pk.name,
            group: fkLeg.id,
          },
        })
      }
      // Les attributs portés par l'association migrent avec la clé.
      for (const attribute of attributes) {
        holder.columns.push({
          id: attribute.propertyId,
          name: uniqueName(attribute.name, usedNames),
          type: attribute.type,
          size: attribute.size,
          isPrimaryKey: false,
          nullable,
        })
      }
      continue
    }

    // Règle 3 : table de jonction à clé primaire composée.
    junctionTables.push(buildJunctionTable(association, legs, attributes, tables, primaryKeys))
  }

  return [...tables.values(), ...junctionTables]
}

function buildJunctionTable(
  association: Association,
  legs: Association['legs'],
  attributes: ReturnType<typeof resolveAttributes>,
  tables: Map<string, MldTable>,
  primaryKeys: Map<string, MldColumn[]>,
): MldTable {
  const usedNames = new Set<string>()
  const columns: MldColumn[] = []

  for (const leg of legs) {
    const target = tables.get(leg.entityId)!
    const targetPk = primaryKeys.get(leg.entityId) ?? []
    for (const pk of targetPk) {
      // En réflexif, le rôle distingue les colonnes des deux pattes.
      const base = leg.role?.trim() ? `${leg.role.trim()}_${pk.name}` : pk.name
      columns.push({
        id: `${leg.id}:${pk.id}`,
        name: uniqueName(base, usedNames),
        type: pk.type,
        size: pk.size,
        isPrimaryKey: true,
        nullable: false,
        references: {
          tableId: target.id,
          tableName: target.name,
          columnName: pk.name,
          group: leg.id,
        },
      })
    }
  }

  for (const attribute of attributes) {
    columns.push({
      id: attribute.propertyId,
      name: uniqueName(attribute.name, usedNames),
      type: attribute.type,
      size: attribute.size,
      isPrimaryKey: false,
      nullable: false,
    })
  }

  return { id: association.id, name: association.name, columns }
}
