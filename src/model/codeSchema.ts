import type { AttributeType, Mcd } from './mcd'
import type { MldTable } from './mld'
import { buildMpd } from './mpd'
import type { MpdSettings, MpdTable } from './mpd'
import { toCamelCase, toPascalCase, toPluralSnakeCase, toSnakeCase, uniqueName } from './names'
import { findLeg } from './queries'

/**
 * Le schéma de code : ce qu'il faut pour écrire des modèles Eloquent ou
 * des entités Doctrine, en une seule dérivation partagée par les deux
 * frameworks.
 *
 * Deux sources, et c'est voulu. La structure et les types viennent du
 * MPD, donc le dialecte et les surcharges de l'utilisateur se
 * retrouvent dans le code généré. Les relations, elles, viennent du
 * MCD : le MLD ne garde pas la cardinalité de la patte visée, donc un
 * plusieurs à un et un un à un y sont indiscernables. Les identifiants
 * font le pont, `references.group` étant l'identifiant de la patte.
 */

export type RelationKind = 'manyToOne' | 'oneToMany' | 'oneToOne' | 'oneToOneInverse'

/** Une colonne de clé étrangère et la colonne qu'elle vise. */
export interface KeyPair {
  foreignColumn: string
  referencedColumn: string
}

export interface Relation {
  id: string
  kind: RelationKind
  /** Nom de la méthode ou de la propriété, en camelCase. */
  name: string
  /** Nom de l'autre bout, pour `inversedBy` et `mappedBy`. */
  inverseName: string
  targetTableId: string
  /** Toujours vu du côté qui porte la clé étrangère. */
  key: KeyPair[]
  nullable: boolean
  selfReferencing: boolean
  /** La phrase Merise d'origine, mise en commentaire du code généré. */
  comment: string
  associationId: string
  legId: string
}

/** Vue plusieurs à plusieurs d'une association binaire de jonction. */
export interface ManyToManyRelation {
  id: string
  name: string
  inverseName: string
  /** Côté propriétaire : la première patte de l'association. */
  owner: boolean
  targetTableId: string
  pivotTableId: string
  pivotTableName: string
  /** Du pivot vers la table courante. */
  localKey: KeyPair[]
  /** Du pivot vers la table visée. */
  targetKey: KeyPair[]
  /** Attributs portés par l'association. */
  payloadColumns: SchemaColumn[]
  /** Une des deux clés tient sur plusieurs colonnes. */
  composite: boolean
  comment: string
  associationId: string
}

export interface SchemaColumn {
  /** Identifiant du MLD : `propertyId`, ou `legId:propertyId` pour une clé. */
  id: string
  columnName: string
  propertyName: string
  conceptualType: AttributeType
  size?: number
  /** Type SQL final du MPD, surcharge comprise. */
  sqlType: string
  overridden: boolean
  isPrimaryKey: boolean
  autoIncrement: boolean
  nullable: boolean
  foreignKey?: { group: string; targetTableId: string; referencedColumn: string }
}

export interface SchemaTable {
  id: string
  /** Nom du MCD, tel quel : « Client », « inscrire ». */
  sourceName: string
  tableName: string
  className: string
  origin: 'entity' | 'junction'
  columns: SchemaColumn[]
  /** Vide quand l'entité n'a pas d'identifiant. */
  primaryKey: SchemaColumn[]
  /** Jonction : nombre de clés étrangères retenues. */
  legCount: number
  /** Jonction : attributs portés par l'association. */
  carriedColumns: SchemaColumn[]
  relations: Relation[]
  manyToMany: ManyToManyRelation[]
}

export interface CodeSchema {
  tables: SchemaTable[]
  /** Le MPD renommé aux conventions, prêt pour `mpdToSql`. */
  physicalTables: MpdTable[]
}

/** Les groupes de clés étrangères d'une table, dans l'ordre des colonnes. */
function foreignKeyGroups(table: SchemaTable): { group: string; columns: SchemaColumn[] }[] {
  const groups: { group: string; columns: SchemaColumn[] }[] = []
  for (const column of table.columns) {
    if (!column.foreignKey) continue
    const existing = groups.find((candidate) => candidate.group === column.foreignKey?.group)
    if (existing) {
      existing.columns.push(column)
    } else {
      groups.push({ group: column.foreignKey.group, columns: [column] })
    }
  }
  return groups
}

/** « Commande (1,1) passer Client (0,n). » */
function merisePhrase(
  fromName: string,
  fromCardinality: { min: 0 | 1; max: 1 | 'n' },
  associationName: string,
  toName: string,
  toCardinality: { min: 0 | 1; max: 1 | 'n' },
): string {
  const card = (value: { min: 0 | 1; max: 1 | 'n' }) => `(${value.min},${value.max})`
  return `${fromName} ${card(fromCardinality)} ${associationName} ${toName} ${card(toCardinality)}.`
}

export function buildCodeSchema(mcd: Mcd, tables: MldTable[], settings: MpdSettings): CodeSchema {
  const mpd = buildMpd(tables, settings)
  const entityIds = new Set(mcd.entities.map((entity) => entity.id))
  const entityNames = new Map(mcd.entities.map((entity) => [entity.id, entity.name]))

  const usedTableNames = new Set<string>()
  const usedClassNames = new Set<string>()
  /** Les noms déjà pris dans une table : colonnes puis relations. */
  const usedMembers = new Map<string, Set<string>>()
  /** Colonne d'une table, par son nom d'origine, pour relire une cible. */
  const byOriginalName = new Map<string, Map<string, SchemaColumn>>()

  const schemaTables: SchemaTable[] = mpd.map((table) => {
    const origin: SchemaTable['origin'] = entityIds.has(table.id) ? 'entity' : 'junction'
    const usedColumns = new Set<string>()
    const members = new Set<string>()
    const originals = new Map<string, SchemaColumn>()

    const columns: SchemaColumn[] = table.columns.map((column) => {
      const schemaColumn: SchemaColumn = {
        id: column.id,
        // Le passage en snake_case peut rapprocher deux noms que le MLD
        // gardait distincts : on dédoublonne par table.
        columnName: uniqueName(toSnakeCase(column.name), usedColumns),
        propertyName: uniqueName(toCamelCase(column.name), members),
        conceptualType: column.conceptualType,
        sqlType: column.sqlType,
        overridden: column.overridden,
        isPrimaryKey: column.isPrimaryKey,
        autoIncrement: column.autoIncrement,
        nullable: column.nullable,
      }
      const source = tables.find((candidate) => candidate.id === table.id)
      const mldColumn = source?.columns.find((candidate) => candidate.id === column.id)
      if (mldColumn?.size !== undefined) {
        schemaColumn.size = mldColumn.size
      }
      if (column.references) {
        schemaColumn.foreignKey = {
          group: column.references.group,
          targetTableId: column.references.tableId,
          referencedColumn: column.references.columnName,
        }
      }
      originals.set(column.name, schemaColumn)
      return schemaColumn
    })

    usedMembers.set(table.id, members)
    byOriginalName.set(table.id, originals)

    const primaryKey = columns.filter((column) => column.isPrimaryKey)
    return {
      id: table.id,
      sourceName: table.name,
      tableName: uniqueName(
        origin === 'entity' ? toPluralSnakeCase(table.name) : toSnakeCase(table.name),
        usedTableNames,
      ),
      className: uniqueName(toPascalCase(table.name), usedClassNames),
      origin,
      columns,
      primaryKey,
      legCount: 0,
      carriedColumns: [],
      relations: [],
      manyToMany: [],
    }
  })

  const byId = new Map(schemaTables.map((table) => [table.id, table]))

  /** Nom de colonne renommé d'une cible, depuis son nom d'origine. */
  const targetColumnName = (tableId: string, originalName: string): string =>
    byOriginalName.get(tableId)?.get(originalName)?.columnName ?? toSnakeCase(originalName)

  /*
   * La colonne visée est encore nommée comme dans le MLD : on la
   * renomme une fois pour toutes, pour que tout le reste du générateur
   * lise des noms physiques.
   */
  for (const table of schemaTables) {
    for (const column of table.columns) {
      if (!column.foreignKey) continue
      column.foreignKey = {
        ...column.foreignKey,
        referencedColumn: targetColumnName(column.foreignKey.targetTableId, column.foreignKey.referencedColumn),
      }
    }
  }

  const pairsOf = (columns: SchemaColumn[]): KeyPair[] =>
    columns.map((column) => ({
      foreignColumn: column.columnName,
      referencedColumn: column.foreignKey?.referencedColumn ?? '',
    }))

  /** Nom de membre libre dans une table, à partir d'une base. */
  const memberName = (tableId: string, base: string): string => {
    const members = usedMembers.get(tableId) ?? new Set<string>()
    usedMembers.set(tableId, members)
    return uniqueName(base, members)
  }

  for (const table of schemaTables) {
    const groups = foreignKeyGroups(table)
    table.legCount = groups.length
    if (table.origin === 'junction') {
      table.carriedColumns = table.columns.filter((column) => column.foreignKey === undefined)
    }

    for (const { group, columns } of groups) {
      const found = findLeg(mcd, group)
      const target = byId.get(columns[0]?.foreignKey?.targetTableId ?? '')
      if (!found || !target) continue
      const { association, leg } = found
      const otherLeg = association.legs.find((candidate) => candidate.id !== leg.id)
      const selfReferencing = target.id === table.id
      const nullable = columns.some((column) => column.nullable)
      const holderName = entityNames.get(table.id) ?? table.sourceName
      const targetName = entityNames.get(target.id) ?? target.sourceName

      /*
       * Côté entité, la cardinalité de la patte visée tranche : en face
       * d'un max 1, la relation est un un à un, sinon un plusieurs à un.
       * Côté jonction, chaque patte est un plusieurs à un.
       */
      const toOne = table.origin === 'entity' && otherLeg?.cardinality.max === 1
      const ownRole = leg.role?.trim()
      const targetRole = otherLeg?.role?.trim()

      const name = memberName(table.id, toCamelCase(targetRole ?? ownRole ?? targetName))
      const inverseBase = toOne
        ? toCamelCase(ownRole ?? holderName)
        : toPluralSnakeCase(ownRole ?? holderName)
      const inverseName = memberName(target.id, toCamelCase(inverseBase))

      /*
       * Une jonction n'est pas une entité du MCD : la phrase Merise de
       * ses relations dit d'où elle vient, plutôt que d'inventer une
       * cardinalité entre une table de liaison et une entité.
       */
      const fromJunction = table.origin === 'junction'
      const card = `(${leg.cardinality.min},${leg.cardinality.max})`
      const comment = fromJunction
        ? `Jonction ${table.sourceName} vers ${targetName} ${card}.`
        : merisePhrase(
            holderName,
            leg.cardinality,
            association.name,
            targetName,
            otherLeg?.cardinality ?? leg.cardinality,
          )
      const inverseComment = fromJunction
        ? `${targetName} ${card} ${association.name} : lignes de la jonction ${table.sourceName}.`
        : merisePhrase(
            targetName,
            otherLeg?.cardinality ?? leg.cardinality,
            association.name,
            holderName,
            leg.cardinality,
          )

      table.relations.push({
        id: leg.id,
        kind: toOne ? 'oneToOne' : 'manyToOne',
        name,
        inverseName,
        targetTableId: target.id,
        key: pairsOf(columns),
        nullable,
        selfReferencing,
        comment,
        associationId: association.id,
        legId: leg.id,
      })

      target.relations.push({
        id: `${leg.id}:inverse`,
        kind: toOne ? 'oneToOneInverse' : 'oneToMany',
        name: inverseName,
        inverseName: name,
        targetTableId: table.id,
        key: pairsOf(columns),
        nullable,
        selfReferencing,
        comment: inverseComment,
        associationId: association.id,
        legId: leg.id,
      })
    }
  }

  /*
   * Une jonction à deux clés étrangères se lit aussi en plusieurs à
   * plusieurs : c'est la table pivot des frameworks. À trois pattes et
   * plus, cette lecture n'existe pas, la jonction reste une entité.
   */
  for (const pivot of schemaTables) {
    if (pivot.origin !== 'junction' || pivot.legCount !== 2) continue
    const groups = foreignKeyGroups(pivot)
    const sides = groups
      .map((group) => ({ group, table: byId.get(group.columns[0]?.foreignKey?.targetTableId ?? '') }))
      .filter((side): side is { group: (typeof groups)[number]; table: SchemaTable } => side.table !== undefined)
    if (sides.length !== 2) continue

    const composite = sides.some((side) => side.group.columns.length > 1)
    const association = mcd.associations.find((candidate) => candidate.id === pivot.id)

    sides.forEach((side, index) => {
      const other = sides[1 - index]
      if (!other) return
      const found = findLeg(mcd, side.group.group)
      const otherFound = findLeg(mcd, other.group.group)
      const sideName = entityNames.get(side.table.id) ?? side.table.sourceName
      const otherName = entityNames.get(other.table.id) ?? other.table.sourceName
      const name = memberName(
        side.table.id,
        toCamelCase(toPluralSnakeCase(otherFound?.leg.role?.trim() ?? otherName)),
      )
      side.table.manyToMany.push({
        id: `${pivot.id}:${side.table.id}`,
        name,
        // Le nom de l'autre bout est calculé au tour suivant : on le
        // recompose ici de la même façon, sans réserver deux fois.
        inverseName: toCamelCase(toPluralSnakeCase(found?.leg.role?.trim() ?? sideName)),
        owner: index === 0,
        targetTableId: other.table.id,
        pivotTableId: pivot.id,
        pivotTableName: pivot.tableName,
        localKey: pairsOf(side.group.columns),
        targetKey: pairsOf(other.group.columns),
        payloadColumns: pivot.carriedColumns,
        composite,
        comment: merisePhrase(
          sideName,
          found?.leg.cardinality ?? { min: 0, max: 'n' },
          association?.name ?? pivot.sourceName,
          otherName,
          otherFound?.leg.cardinality ?? { min: 0, max: 'n' },
        ),
        associationId: pivot.id,
      })
    })
  }

  /* Le MPD renommé : même structure, noms du framework. */
  const physicalTables: MpdTable[] = mpd.map((table) => {
    const schema = byId.get(table.id)
    return {
      id: table.id,
      name: schema?.tableName ?? toSnakeCase(table.name),
      columns: table.columns.map((column) => {
        const renamed = byOriginalName.get(table.id)?.get(column.name)
        const next: MpdTable['columns'][number] = {
          ...column,
          name: renamed?.columnName ?? toSnakeCase(column.name),
        }
        if (column.references) {
          next.references = {
            ...column.references,
            tableName: byId.get(column.references.tableId)?.tableName ?? column.references.tableName,
            columnName: targetColumnName(column.references.tableId, column.references.columnName),
          }
        }
        return next
      }),
    }
  })

  return { tables: schemaTables, physicalTables }
}
