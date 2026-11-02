import type { MpdTable } from './mpd'
import { t } from '../i18n/runtime'
import type { MpdSettings } from './mpd'
import { parseSqlType } from './sqlTypes'

/** DBAL ne distingue pas ces types MySQL à l'introspection sans configuration dédiée. */
export function doctrineCompatibilityWarnings(settings: MpdSettings, tables: MpdTable[]): string[] {
  if (settings.dialect !== 'mysql') return []
  const names = new Set(tables.flatMap(table => table.columns.map(column => column.sqlType)).map(raw => parseSqlType(raw)?.name))
  const warnings: string[] = []
  if (names.has('TINYINT')) warnings.push(t('TINYINT MySQL est relu comme BOOLEAN par Doctrine. Pour le parcours automatique, utilisez SMALLINT si sa plage convient, ou configurez un type Doctrine personnalisé.'))
  if (names.has('TIMESTAMP')) warnings.push(t('TIMESTAMP MySQL est comparé à DATETIME par Doctrine, ce qui peut produire des migrations répétées. Utilisez DATETIME si adapté, ou configurez un mappage Doctrine personnalisé.'))
  return warnings
}
