import type { CodeSchema, SchemaColumn, SchemaTable } from './codeSchema'
import type { GeneratedFile } from './codegenTypes'
import { phpString, phpStringList } from './php'

/**
 * Migrations Laravel : une par table, en classe anonyme, comme les
 * squelettes du framework depuis Laravel 9.
 *
 * La date est figée et identique pour toutes : `php artisan migrate` ne
 * lit que l'ordre relatif des noms de fichiers, et une date fixe rend la
 * génération déterministe, donc vérifiable par des tests.
 */

export const LARAVEL_MIGRATION_DATE = '2025_01_01'

/** Appel de colonne du Blueprint, selon le type conceptuel. */
function blueprintCall(column: SchemaColumn): string {
  const name = phpString(column.columnName)
  switch (column.conceptualType) {
    case 'texte':
      return column.size === undefined
        ? `$table->string(${name})`
        : `$table->string(${name}, ${column.size})`
    case 'entier':
      return `$table->integer(${name})`
    case 'decimal':
      return `$table->decimal(${name}, 10, 2)`
    case 'booleen':
      return `$table->boolean(${name})`
    case 'date':
      return `$table->date(${name})`
    case 'datetime':
      return `$table->dateTime(${name})`
    case 'heure':
      return `$table->time(${name})`
  }
}

/** Une surcharge du MPD ne se traduit pas en Blueprint : on la signale. */
function overrideComment(column: SchemaColumn): string[] {
  return column.overridden ? [`// Type imposé au MPD : ${column.sqlType}`] : []
}

/**
 * Une clé étrangère passe par `foreignId()->constrained()` seulement si
 * elle tient sur une colonne et vise une clé auto-incrémentée : c'est le
 * seul cas où le type que Laravel fabrique correspond vraiment à la
 * colonne visée. Sinon, colonne explicite et contrainte à part.
 */
function isConstrainable(columns: SchemaColumn[], schema: CodeSchema): boolean {
  if (columns.length !== 1) return false
  const column = columns[0] as SchemaColumn
  const target = schema.tables.find((table) => table.id === column.foreignKey?.targetTableId)
  const targetColumn = target?.primaryKey.find(
    (candidate) => candidate.columnName === column.foreignKey?.referencedColumn,
  )
  return targetColumn?.autoIncrement === true && target?.primaryKey.length === 1
}

function groupsOf(table: SchemaTable): { group: string; columns: SchemaColumn[] }[] {
  const groups: { group: string; columns: SchemaColumn[] }[] = []
  for (const column of table.columns) {
    const key = column.foreignKey?.group
    if (key === undefined) continue
    const existing = groups.find((candidate) => candidate.group === key)
    if (existing) existing.columns.push(column)
    else groups.push({ group: key, columns: [column] })
  }
  return groups
}

export function laravelMigrationFile(
  table: SchemaTable,
  schema: CodeSchema,
  index: number,
  withTimestamps: boolean,
): GeneratedFile {
  const lines: string[] = []
  const constrained = new Set<string>()
  const groups = groupsOf(table)
  const simplePrimary = table.primaryKey.length === 1 ? (table.primaryKey[0] as SchemaColumn) : null
  const autoPrimary =
    simplePrimary && simplePrimary.autoIncrement && simplePrimary.foreignKey === undefined
      ? simplePrimary
      : null

  for (const column of table.columns) {
    if (column === autoPrimary) {
      lines.push(`$table->id(${phpString(column.columnName)});`)
      continue
    }
    const group = column.foreignKey?.group
    const groupColumns = groups.find((candidate) => candidate.group === group)?.columns ?? []
    if (group !== undefined && isConstrainable(groupColumns, schema)) {
      const target = schema.tables.find((candidate) => candidate.id === column.foreignKey?.targetTableId)
      const nullable = column.nullable ? '->nullable()' : ''
      lines.push(...overrideComment(column))
      lines.push(
        `$table->foreignId(${phpString(column.columnName)})${nullable}->constrained(` +
          `${phpString(target?.tableName ?? '')}, ${phpString(column.foreignKey?.referencedColumn ?? '')});`,
      )
      constrained.add(group)
      continue
    }
    lines.push(...overrideComment(column))
    lines.push(`${blueprintCall(column)}${column.nullable ? '->nullable()' : ''};`)
  }

  if (withTimestamps) {
    lines.push('$table->timestamps();')
  }

  // Clé primaire : `id()` l'a déjà posée, sinon contrainte explicite.
  if (!autoPrimary && table.primaryKey.length > 0) {
    const names = table.primaryKey.map((column) => column.columnName)
    lines.push(
      names.length === 1
        ? `$table->primary(${phpString(names[0] as string)});`
        : `$table->primary(${phpStringList(names)});`,
    )
  }
  if (table.primaryKey.length === 0) {
    lines.push(`// Attention : ${table.sourceName} n'a pas d'identifiant dans le MCD.`)
  }

  // Les clés étrangères que `constrained()` n'a pas pu porter.
  for (const { group, columns } of groups) {
    if (constrained.has(group)) continue
    const target = schema.tables.find((candidate) => candidate.id === columns[0]?.foreignKey?.targetTableId)
    const locals = columns.map((column) => column.columnName)
    const remotes = columns.map((column) => column.foreignKey?.referencedColumn ?? '')
    const local = locals.length === 1 ? phpString(locals[0] as string) : phpStringList(locals)
    const remote = remotes.length === 1 ? phpString(remotes[0] as string) : phpStringList(remotes)
    lines.push(
      `$table->foreign(${local})->references(${remote})->on(${phpString(target?.tableName ?? '')});`,
    )
  }

  const body = lines.map((line) => `            ${line}`).join('\n')
  const suffix = String(index).padStart(6, '0')
  const origin =
    table.origin === 'entity'
      ? `l'entité ${table.sourceName}`
      : `l'association ${table.sourceName}`

  const content = `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

/** Table ${table.tableName}, dérivée de ${origin} du MCD. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create(${phpString(table.tableName)}, function (Blueprint $table) {
${body}
        });
    }

    public function down(): void
    {
        Schema::dropIfExists(${phpString(table.tableName)});
    }
};
`

  return {
    path: `database/migrations/${LARAVEL_MIGRATION_DATE}_${suffix}_create_${table.tableName}_table.php`,
    content,
  }
}
