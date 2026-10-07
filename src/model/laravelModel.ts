import type { CodeSchema, ManyToManyRelation, Relation, SchemaColumn, SchemaTable } from './codeSchema'
import type { GeneratedFile } from './codegenTypes'
import { phpString, phpStringBlock } from './php'

/**
 * Modèles Eloquent : un par table qui mérite un objet. Les conventions
 * de Laravel sont respectées, et ce que le framework ne sait pas faire
 * est dit en commentaire plutôt que produit à moitié.
 */

const RELATION_CLASS: Record<Relation['kind'], string> = {
  manyToOne: 'BelongsTo',
  oneToOne: 'BelongsTo',
  oneToMany: 'HasMany',
  oneToOneInverse: 'HasOne',
}

const RELATION_METHOD: Record<Relation['kind'], string> = {
  manyToOne: 'belongsTo',
  oneToOne: 'belongsTo',
  oneToMany: 'hasMany',
  oneToOneInverse: 'hasOne',
}

function className(schema: CodeSchema, tableId: string): string {
  return schema.tables.find((table) => table.id === tableId)?.className ?? 'Model'
}

/** Une relation sur clé composée ne se déclare pas : on l'explique. */
function compositeComment(relation: Relation, target: string): string[] {
  const columns = relation.key.map((pair) => pair.foreignColumn).join(', ')
  return [
    `    // ${relation.comment}`,
    `    // Clé étrangère composée (${columns}) vers ${target} : Eloquent ne sait pas`,
    '    // suivre une clé composée, cette relation est à écrire à la main.',
  ]
}

function relationMethod(relation: Relation, schema: CodeSchema): string[] {
  const target = className(schema, relation.targetTableId)
  if (relation.key.length > 1) {
    return compositeComment(relation, target)
  }
  const pair = relation.key[0]
  if (!pair) return []
  const self = relation.selfReferencing
  const targetClass = self ? 'self::class' : `${target}::class`
  const owner = relation.kind === 'manyToOne' || relation.kind === 'oneToOne'
  // belongsTo prend la clé portée puis la clé visée ; hasMany et hasOne
  // prennent la clé portée en face puis la clé locale.
  const keys = owner
    ? `${phpString(pair.foreignColumn)}, ${phpString(pair.referencedColumn)}`
    : `${phpString(pair.foreignColumn)}, ${phpString(pair.referencedColumn)}`
  return [
    `    /** ${relation.comment} */`,
    `    public function ${relation.name}(): ${RELATION_CLASS[relation.kind]}`,
    '    {',
    `        return $this->${RELATION_METHOD[relation.kind]}(${targetClass}, ${keys});`,
    '    }',
  ]
}

function manyToManyMethod(relation: ManyToManyRelation, schema: CodeSchema): string[] {
  const target = className(schema, relation.targetTableId)
  if (relation.composite) {
    return [
      `    // ${relation.comment}`,
      `    // Table pivot ${relation.pivotTableName} à clé composée : belongsToMany ne`,
      `    // sait pas la suivre, passez par le modèle de jonction.`,
    ]
  }
  const local = relation.localKey[0]
  const remote = relation.targetKey[0]
  if (!local || !remote) return []
  const pivot = [
    `            ${target}::class,`,
    `            ${phpString(relation.pivotTableName)},`,
    `            ${phpString(local.foreignColumn)},`,
    `            ${phpString(remote.foreignColumn)},`,
    `            ${phpString(local.referencedColumn)},`,
    `            ${phpString(remote.referencedColumn)},`,
  ]
  const withPivot =
    relation.payloadColumns.length > 0
      ? `->withPivot(${relation.payloadColumns.map((column) => phpString(column.columnName)).join(', ')})`
      : ''
  return [
    `    /** ${relation.comment} */`,
    `    public function ${relation.name}(): BelongsToMany`,
    '    {',
    '        return $this->belongsToMany(',
    ...pivot,
    `        )${withPivot};`,
    '    }',
  ]
}

function fillableColumns(table: SchemaTable): SchemaColumn[] {
  return table.columns.filter((column) => !column.autoIncrement)
}

export function laravelModelFile(table: SchemaTable, schema: CodeSchema): GeneratedFile {
  const relations = table.relations.filter((relation) => relation.key.length > 0)
  const imports = new Set<string>(['use Illuminate\\Database\\Eloquent\\Model;'])
  for (const relation of relations) {
    if (relation.key.length > 1) continue
    imports.add(`use Illuminate\\Database\\Eloquent\\Relations\\${RELATION_CLASS[relation.kind]};`)
  }
  if (table.manyToMany.some((relation) => !relation.composite)) {
    imports.add('use Illuminate\\Database\\Eloquent\\Relations\\BelongsToMany;')
  }

  const simplePrimary = table.primaryKey.length === 1 ? (table.primaryKey[0] as SchemaColumn) : null
  const properties: string[] = [`    protected $table = ${phpString(table.tableName)};`]

  if (simplePrimary && simplePrimary.columnName !== 'id') {
    properties.push('', `    protected $primaryKey = ${phpString(simplePrimary.columnName)};`)
  }
  if (simplePrimary && simplePrimary.conceptualType !== 'entier') {
    properties.push('', `    protected $keyType = 'string';`)
  }
  if (!simplePrimary || !simplePrimary.autoIncrement) {
    properties.push('', '    public $incrementing = false;')
  }
  if (table.primaryKey.length > 1) {
    properties.push(
      '',
      `    // Eloquent ne gère pas les clés primaires composées`,
      `    // (${table.primaryKey.map((column) => column.columnName).join(', ')}) :`,
      '    // les écritures par clé demandent une requête explicite.',
    )
  }
  if (table.primaryKey.length === 0) {
    properties.push('', `    // ${table.sourceName} n'a pas d'identifiant dans le MCD.`)
  }

  const fillable = fillableColumns(table).map((column) => column.columnName)
  properties.push('', `    protected $fillable = ${phpStringBlock(fillable, '    ')};`)

  const methods = [
    ...relations.flatMap((relation) => ['', ...relationMethod(relation, schema)]),
    ...table.manyToMany.flatMap((relation) => ['', ...manyToManyMethod(relation, schema)]),
  ]

  const origin =
    table.origin === 'entity'
      ? `Entité ${table.sourceName} du MCD.`
      : `Jonction ${table.sourceName} du MCD.`

  const content = `<?php

namespace App\\Models;

${[...imports].sort().join('\n')}

/** ${origin} */
class ${table.className} extends Model
{
${properties.join('\n')}
${methods.join('\n')}
}
`

  return { path: `app/Models/${table.className}.php`, content }
}
