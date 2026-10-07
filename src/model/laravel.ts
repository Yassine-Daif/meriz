import type { CodeSchema, SchemaTable } from './codeSchema'
import type { GeneratedFile } from './codegenTypes'
import { laravelMigrationFile } from './laravelMigration'
import { laravelModelFile } from './laravelModel'
import { sortForCreation } from './mpd'

/**
 * Les fichiers Laravel d'un schéma : une migration par table, dans
 * l'ordre de création, et un modèle par table qui mérite un objet.
 *
 * Une table pivot pure, c'est-à-dire deux pattes, aucune colonne portée
 * et des clés simples, ne reçoit pas de modèle : `belongsToMany` la
 * traverse déjà des deux côtés. Dès qu'elle porte un attribut, qu'elle
 * a trois pattes ou une clé composée, elle devient un modèle de
 * jonction à part entière, comme la règle Merise l'attend.
 */

/** Une des clés étrangères de la table tient sur plusieurs colonnes. */
function hasCompositeKey(table: SchemaTable): boolean {
  const counts = new Map<string, number>()
  for (const column of table.columns) {
    const group = column.foreignKey?.group
    if (group === undefined) continue
    counts.set(group, (counts.get(group) ?? 0) + 1)
  }
  return [...counts.values()].some((count) => count > 1)
}

export function hasModel(table: SchemaTable): boolean {
  if (table.origin === 'entity') return true
  if (table.legCount !== 2) return true
  if (table.carriedColumns.length > 0) return true
  // Pivot pur à clés simples : belongsToMany le traverse des deux côtés,
  // donc aucun modèle n'est nécessaire. À clé composée, Eloquent ne sait
  // pas le faire, et le modèle de jonction devient la seule voie.
  return hasCompositeKey(table)
}

/** Un pivot absorbé par `belongsToMany` n'entretient pas de timestamps. */
function wantsTimestamps(table: SchemaTable): boolean {
  return hasModel(table)
}

export function laravelFiles(schema: CodeSchema): GeneratedFile[] {
  /*
   * L'ordre des migrations compte : une table référencée doit exister
   * avant celle qui la référence. Le tri du MPD le fait déjà.
   */
  const creationOrder = sortForCreation(schema.physicalTables).map((table) => table.id)
  const ordered = [...schema.tables].sort(
    (a, b) => creationOrder.indexOf(a.id) - creationOrder.indexOf(b.id),
  )

  const migrations = ordered.map((table, index) =>
    laravelMigrationFile(table, schema, index + 1, wantsTimestamps(table)),
  )
  const models = ordered.filter(hasModel).map((table) => laravelModelFile(table, schema))

  return [...migrations, ...models]
}
