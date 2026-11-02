import { blueprintColumn } from './frameworkSqlTypes'
import { t } from '../i18n/runtime'
import type { CodeSchema, SchemaColumn, SchemaTable } from './codeSchema'
import type { GeneratedFile } from './codegenTypes'
import { phpString, phpStringList } from './php'

export const LARAVEL_MIGRATION_DATE = '2025_01_01'

export function foreignGroups(table: SchemaTable): { group: string; columns: SchemaColumn[] }[] {
  const groups = new Map<string, SchemaColumn[]>()
  for (const column of table.columns) {
    if (!column.foreignKey) continue
    const group = groups.get(column.foreignKey.group) ?? []
    group.push(column); groups.set(column.foreignKey.group, group)
  }
  return [...groups].map(([group, columns]) => ({ group, columns }))
}
const list = (names: string[]) => names.length === 1 ? phpString(names[0]!) : phpStringList(names)

export function foreignStatements(table: SchemaTable, schema: CodeSchema, groups: Set<string>): string[] {
  return foreignGroups(table).filter(group => groups.has(group.group)).map(({ columns }) => {
    const target = schema.tables.find(candidate => candidate.id === columns[0]?.foreignKey?.targetTableId)
    return `$table->foreign(${list(columns.map(c => c.columnName))})->references(${list(columns.map(c => c.foreignKey!.referencedColumn))})->on(${phpString(target?.tableName ?? '')});`
  })
}

function migrationFile(name: string, index: number, up: string[], down: string[], description: string): GeneratedFile {
  return {
    path: `database/migrations/${LARAVEL_MIGRATION_DATE}_${String(index).padStart(6, '0')}_${name}.php`,
    content: `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

/** ${description} */
return new class extends Migration
{
    public function up(): void
    {
${up.map(line => '        ' + line).join('\n')}
    }

    public function down(): void
    {
${down.map(line => '        ' + line).join('\n')}
    }
};
`,
  }
}

/** Les références à une table pas encore créée sont reportées dans une migration finale. */
export function laravelMigrationFile(table: SchemaTable, schema: CodeSchema, index: number, withTimestamps: boolean, deferred = new Set<string>()): GeneratedFile {
  const lines: string[] = []
  const primary = table.primaryKey.length === 1 ? table.primaryKey[0] : undefined
  const auto = primary?.autoIncrement && !primary.foreignKey ? primary : undefined
  for (const column of table.columns) {
    if (column.overridden) lines.push(t('// Type imposé au MPD : {0}', [column.sqlType]))
    lines.push(`${blueprintColumn(column)}${column === auto ? '->autoIncrement()' : column.nullable ? '->nullable()' : ''};`)
  }
  if (withTimestamps) {
    if (!table.columns.some(column => ['created_at', 'updated_at'].includes(column.columnName))) lines.push('$table->timestamps();')
    else for (const name of ['created_at', 'updated_at']) if (!table.columns.some(column => column.columnName === name)) lines.push(`$table->timestamp('${name}')->nullable();`)
  }
  if (!auto && table.primaryKey.length) lines.push(`$table->primary(${list(table.primaryKey.map(c => c.columnName))});`)
  if (!table.primaryKey.length) lines.push(t("// Attention : {0} n'a pas d'identifiant dans le MCD.", [table.sourceName]))
  lines.push(...foreignStatements(table, schema, new Set(foreignGroups(table).map(g => g.group).filter(group => !deferred.has(group)))))
  const origin = table.origin === 'entity' ? t("l'entité {0}", [table.sourceName]) : t('l’association {0}', [table.sourceName])
  return migrationFile(`create_${table.tableName}_table`, index,
    [`Schema::create(${phpString(table.tableName)}, function (Blueprint $table) {`, ...lines.map(line => '    ' + line), '});'],
    [`Schema::dropIfExists(${phpString(table.tableName)});`], t('Table {0}, dérivée de {1} du MCD.', [table.tableName, origin]))
}

export function deferredForeignMigration(schema: CodeSchema, deferred: Map<string, Set<string>>, index: number): GeneratedFile {
  const up: string[] = [], down: string[] = []
  for (const table of schema.tables) {
    const groups = deferred.get(table.id)
    if (!groups?.size) continue
    up.push(`Schema::table(${phpString(table.tableName)}, function (Blueprint $table) {`, ...foreignStatements(table, schema, groups).map(line => '    ' + line), '});')
    down.unshift(`Schema::table(${phpString(table.tableName)}, function (Blueprint $table) {`, ...foreignGroups(table).filter(g => groups.has(g.group)).map(g => `    $table->dropForeign(${phpStringList(g.columns.map(c => c.columnName))});`), '});')
  }
  return migrationFile('add_meriz_foreign_keys', index, up, down, t('Clés étrangères ajoutées après la création des tables.'))
}
