import type { CodeSchema, SchemaTable } from './codeSchema'
import type { GeneratedFile } from './codegenTypes'
import type { SqlDialect } from './mpd'
import { symfonyEntityFile } from './symfonyEntity'
import { symfonyMigrationFile } from './symfonyMigration'

/**
 * Les fichiers Symfony d'un schéma : une entité par table qui mérite un
 * objet, et une migration Doctrine pour tout le schéma.
 *
 * Doctrine absorbe une table pivot en `ManyToMany` quand elle n'a que
 * deux pattes et ne porte aucun attribut, clé composée comprise. Dès
 * qu'un attribut est porté, l'ORM exige une entité : la jonction en
 * devient une, et son identité passe par ses relations.
 */

export function hasEntity(table: SchemaTable): boolean {
  if (table.origin === 'entity') return true
  if (table.legCount !== 2) return true
  return table.carriedColumns.length > 0
}

export function symfonyFiles(schema: CodeSchema, dialect: SqlDialect): GeneratedFile[] {
  const entities = schema.tables.filter(hasEntity).map((table) => symfonyEntityFile(table, schema))
  if (entities.length === 0) {
    return []
  }
  return [...entities, symfonyMigrationFile(schema, dialect)]
}
