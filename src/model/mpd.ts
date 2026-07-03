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
  { id: 'mysql', label: 'MySQL' },
  { id: 'postgresql', label: 'PostgreSQL' },
]

/** Réglages mémorisés : dialecte + surcharges par colonne (id stable). */
export interface MpdSettings {
  dialect: SqlDialect
  overrides: Record<string, string>
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
        const override = settings.overrides[column.id]?.trim()
        const overridden = override !== undefined && override !== ''
        const autoIncrement =
          column.isPrimaryKey &&
          primaryKeys.length === 1 &&
          column.type === 'entier' &&
          column.references === undefined &&
          !overridden
        return {
          id: column.id,
          name: column.name,
          conceptualType: column.type,
          proposedType: proposed,
          sqlType: overridden ? override : proposed,
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
function sortForCreation(tables: MpdTable[]): MpdTable[] {
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
        .map((table) => `DROP TABLE IF EXISTS ${sanitizeSqlName(table.name)};`)
        .join('\n'),
    )
  }

  for (const table of ordered) {
    const lines: string[] = []
    for (const column of table.columns) {
      let typePart = column.sqlType
      if (column.autoIncrement && dialect === 'postgresql') {
        // SERIAL remplace le type et porte l'auto-incrément.
        typePart = 'SERIAL'
      }
      const autoIncrementPart =
        column.autoIncrement && dialect === 'mysql' ? ' AUTO_INCREMENT' : ''
      const nullability = column.nullable ? '' : ' NOT NULL'
      lines.push(`  ${sanitizeSqlName(column.name)} ${typePart}${nullability}${autoIncrementPart}`)
    }
    const primaryKey = table.columns.filter((c) => c.isPrimaryKey)
    if (primaryKey.length > 0) {
      lines.push(`  PRIMARY KEY (${primaryKey.map((c) => sanitizeSqlName(c.name)).join(', ')})`)
    }
    parts.push(`CREATE TABLE ${sanitizeSqlName(table.name)} (\n${lines.join(',\n')}\n);`)
  }

  // Clés étrangères après toutes les créations : plus de contrainte
  // d'ordre. Un groupe (une patte d'origine) = une contrainte.
  const alterStatements: string[] = []
  const usedConstraintNames = new Set<string>()
  for (const table of ordered) {
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
      let constraintName = `fk_${sanitizeSqlName(table.name)}_${sanitizeSqlName(targetName)}`.toLowerCase()
      let n = 2
      while (usedConstraintNames.has(constraintName)) {
        constraintName = `fk_${sanitizeSqlName(table.name)}_${sanitizeSqlName(targetName)}_${n}`.toLowerCase()
        n += 1
      }
      usedConstraintNames.add(constraintName)
      const local = columns.map((c) => sanitizeSqlName(c.name)).join(', ')
      const foreign = columns.map((c) => sanitizeSqlName(c.references?.columnName ?? '')).join(', ')
      alterStatements.push(
        `ALTER TABLE ${sanitizeSqlName(table.name)}\n  ADD CONSTRAINT ${constraintName} FOREIGN KEY (${local}) REFERENCES ${sanitizeSqlName(targetName)} (${foreign});`,
      )
    }
  }
  if (alterStatements.length > 0) {
    parts.push(alterStatements.join('\n\n'))
  }

  return parts.join('\n\n')
}
