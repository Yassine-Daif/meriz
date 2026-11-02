import { sanitizeSqlName } from './sql'
import type { SqlDialect } from './mpd'

/** Les noms comme « Order » restent utilisables sans devenir des mots-clés SQL. */
export function quoteSqlName(name: string, dialect: SqlDialect): string {
  const quote = dialect === 'mysql' ? '`' : '"'
  return quote + sanitizeSqlName(name) + quote
}
