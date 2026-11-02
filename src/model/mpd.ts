import { quoteSqlName } from './sqlIdentifiers'
import { sourcePropertyId } from './mld'
import { parseSqlType, sqlTypeForDialect, formatSqlType, isIntegerType } from './sqlTypes'
import { t } from "../i18n/runtime"
import type { AttributeType } from './mcd'
import type { MldColumn, MldTable } from './mld'
import { sanitizeSqlName } from './sql'

/**
 * MPD : le modèle physique. Structure dérivée du MLD (jamais éditée),
 * plus une couche de mappage de types éditable et mémorisée : le
 * dialecte et les surcharges de type par colonne. C'est ici, et
 * seulement ici, que les types conceptuels deviennent des types SQL.
 */

export type SqlDialect = 'mysql' | 'postgresql'

export const SQL_DIALECTS: readonly { id: SqlDialect; label: string }[] = [
  { id: 'mysql', get label() { return t("MySQL") } },
  { id: 'postgresql', get label() { return t("PostgreSQL") } },
]

/** Réglages mémorisés : dialecte + surcharges par colonne (id stable). */
export interface MpdSettings {
  dialect: SqlDialect
  overrides: Record<string, string>
  identity?: Record<string, boolean>
}

export const DEFAULT_MPD_SETTINGS: MpdSettings = { dialect: 'mysql', overrides: {} }

/** Type SQL proposé pour un type conceptuel, selon le dialecte. */
export function proposedSqlType(type: AttributeType, size: number | undefined, dialect: SqlDialect): string {
  switch (type) {
    case 'texte':
      return `VARCHAR(${size ?? 255})`
    case 'entier':
      return dialect === 'mysql' ? 'INT' : 'INTEGER'
    case 'decimal':
      return dialect === 'mysql' ? 'DECIMAL(10,2)' : 'NUMERIC(10,2)'
    case 'booleen':
      // TINYINT(1) est l'alias BOOLEAN de MySQL.
      return dialect === 'mysql' ? 'TINYINT(1)' : 'BOOLEAN'
    case 'date':
      return 'DATE'
    case 'datetime':
      return dialect === 'mysql' ? 'DATETIME' : 'TIMESTAMP'
    case 'heure':
      return 'TIME'
  }
}

export interface MpdColumn {
  id: string
  name: string
  conceptualType: AttributeType
  /** Type SQL proposé par le mappage du dialecte. */
  proposedType: string
  /** Type SQL final : la surcharge de l'utilisateur, sinon la proposition. */
  sqlType: string
  overridden: boolean
  isPrimaryKey: boolean
  nullable: boolean
  /** PK simple, entière, sans surcharge : auto-incrément pertinent. */
  autoIncrement: boolean
  references?: MldColumn['references']
}

export interface MpdTable {
  id: string
  name: string
  columns: MpdColumn[]
}

/** Dérive le MPD : structure du MLD + types SQL selon les réglages. */
export function buildMpd(tables: MldTable[], settings: MpdSettings): MpdTable[] {
  return tables.map((table) => {
    const primaryKeys = table.columns.filter((c) => c.isPrimaryKey)
    return {
      id: table.id,
      name: table.name,
      columns: table.columns.map((column): MpdColumn => {
        const proposed = proposedSqlType(column.type, column.size, settings.dialect)
        // Une FK hérite du type physique de la colonne visée, même si celui-ci change en direct.
        const sourceId = sourcePropertyId(column, tables)
        const override = (settings.overrides[column.id] ?? settings.overrides[sourceId])?.trim()
        const overridden = override !== undefined && override !== ''
        const explicitIdentity = settings.identity?.[sourceId]
        const parsed = parseSqlType(overridden ? override : proposed)
        const translated = parsed && sqlTypeForDialect(parsed, settings.dialect)
        const finalType = translated ? formatSqlType(translated) : overridden ? override : proposed
        const autoIncrement =
          column.isPrimaryKey &&
          primaryKeys.length === 1 &&
          column.references === undefined &&
          (explicitIdentity === true ? !!parsed && isIntegerType(parsed.name) : explicitIdentity !== false && column.type === 'entier' && !overridden)
        return {
          id: column.id,
          name: column.name,
          conceptualType: column.type,
          proposedType: proposed,
          sqlType: finalType,
          overridden,
          isPrimaryKey: column.isPrimaryKey,
          nullable: column.nullable,
          autoIncrement,
          references: column.references,
        }
      }),
    }
  })
}

/**
 * Tri topologique : une table est créée après celles qu'elle
 * référence (auto-référence permise). En cas de cycle, l'ordre
 * d'origine est conservé pour le reste. Avec les clés étrangères en
 * ALTER TABLE l'ordre des CREATE importe moins, mais celui des DROP
 * reste sensible.
 */
export function sortForCreation(tables: MpdTable[]): MpdTable[] {
  const remaining = new Map(tables.map((table) => [table.id, table]))
  const dependencies = new Map<string, string[]>(
    tables.map((table) => [
      table.id,
      table.columns
        .filter((c) => c.references !== undefined && c.references.tableId !== table.id)
        .map((c) => c.references?.tableId ?? ''),
    ]),
  )
  const sorted: MpdTable[] = []
  while (remaining.size > 0) {
    let progressed = false
    for (const [id, table] of remaining) {
      const blocked = (dependencies.get(id) ?? []).some((dep) => remaining.has(dep))
      if (!blocked) {
        sorted.push(table)
        remaining.delete(id)
        progressed = true
      }
    }
    if (!progressed) {
      sorted.push(...remaining.values())
      break
    }
  }
  return sorted
}

export interface SqlOptions {
  includeDrops: boolean
}

/**
 * Dérivation pure MPD → SQL. Les CREATE TABLE d'abord (types, NOT
 * NULL, clé primaire, auto-incrément adapté au dialecte), puis toutes
 * les clés étrangères en ALTER TABLE ADD CONSTRAINT, avec des noms
 * lisibles et déterministes. DROP TABLE IF EXISTS optionnels, en
 * ordre inverse des dépendances.
 */
export function mpdToSql(tables: MpdTable[], dialect: SqlDialect, options: SqlOptions): string {
  const ordered = sortForCreation(tables)
  const parts: string[] = []

  if (options.includeDrops) {
    parts.push(
      [...ordered]
        .reverse()
        .map((table) => ("DROP TABLE IF EXISTS " + String(quoteSqlName(table.name, dialect)) + ";"))
        .join('\n'),
    )
  }

  for (const table of ordered) {
    const lines: string[] = []
    for (const column of table.columns) {
      let typePart = column.sqlType
      if (column.autoIncrement && dialect === 'postgresql') {
        // SERIAL remplace le type et porte l'auto-incrément.
        typePart = column.sqlType === 'BIGINT' ? 'BIGSERIAL' : column.sqlType === 'SMALLINT' ? 'SMALLSERIAL' : 'SERIAL'
      }
      const autoIncrementPart =
        column.autoIncrement && dialect === 'mysql' ? ' AUTO_INCREMENT' : ''
      const nullability = column.nullable ? '' : ' NOT NULL'
      lines.push(`  ${quoteSqlName(column.name, dialect)} ${typePart}${nullability}${autoIncrementPart}`)
    }
    const primaryKey = table.columns.filter((c) => c.isPrimaryKey)
    if (primaryKey.length > 0) {
      lines.push(`  PRIMARY KEY (${primaryKey.map((c) => quoteSqlName(c.name, dialect)).join(', ')})`)
    }
    parts.push(`CREATE TABLE ${quoteSqlName(table.name, dialect)} (\n${lines.join(',\n')}\n);`)
  }

  // Clés étrangères après toutes les créations : plus de contrainte
  // d'ordre. Un groupe (une patte d'origine) = une contrainte.
  const alterStatements = foreignConstraints(tables).map(({ table, columns, targetName, name }) => {
    const local = columns.map(c => quoteSqlName(c.name, dialect)).join(', ')
    const foreign = columns.map(c => quoteSqlName(c.references?.columnName ?? '', dialect)).join(', ')
    return 'ALTER TABLE ' + quoteSqlName(table.name, dialect) + '\n  ADD CONSTRAINT ' + quoteSqlName(name, dialect) + ' FOREIGN KEY (' + local + ') REFERENCES ' + quoteSqlName(targetName, dialect) + ' (' + foreign + ');'
  })
  if (alterStatements.length > 0) {
    parts.push(alterStatements.join('\n\n'))
  }

  return parts.join('\n\n')
}

/** Les mêmes noms déterministes pour créer et retirer uniquement nos contraintes. */
export function foreignConstraints(tables: MpdTable[]): { table: MpdTable; columns: MpdColumn[]; targetName: string; name: string }[] {
  const constraints: { table: MpdTable; columns: MpdColumn[]; targetName: string; name: string }[] = []
  const usedConstraintNames = new Set<string>()
  for (const table of sortForCreation(tables)) {
    const groups = new Map<string, MpdColumn[]>()
    for (const column of table.columns) {
      if (column.references) {
        const group = groups.get(column.references.group)
        if (group) {
          group.push(column)
        } else {
          groups.set(column.references.group, [column])
        }
      }
    }
    for (const columns of groups.values()) {
      const first = columns[0]!
      const targetName = first.references?.tableName ?? ''
      let constraintName = `fk_${sanitizeSqlName(table.name)}_${sanitizeSqlName(targetName)}`.toLowerCase().slice(0, 60)
      let n = 2
      while (usedConstraintNames.has(constraintName)) {
        constraintName = `fk_${sanitizeSqlName(table.name)}_${sanitizeSqlName(targetName)}`.toLowerCase().slice(0, 55) + `_${n}`
        n += 1
      }
      usedConstraintNames.add(constraintName)
      constraints.push({ table, columns, targetName, name: constraintName })
    }
  }
  return constraints
}
