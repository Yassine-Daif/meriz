import type { MpdTable, SqlDialect } from './mpd'
import { formatSqlType, parseSqlType, sqlTypeForDialect } from './sqlTypes'
import { t } from '../i18n/runtime'

/** Une incompatibilité reste visible ; elle ne devient jamais un autre type en silence. */
export function physicalSchemaIssues(tables: MpdTable[], dialect: SqlDialect): string[] {
  const issues: string[] = []
  for (const table of tables) for (const column of table.columns) {
    const spec = parseSqlType(column.sqlType)
    if (!spec || !sqlTypeForDialect(spec, dialect)) { issues.push(t('Type SQL incompatible ou invalide : {0}.{1} ({2}).', [table.name, column.name, column.sqlType])); continue }
    if (column.isPrimaryKey && (dialect === 'mysql' ? ['TEXT', 'JSON', 'BLOB'].includes(spec.name) : spec.name === 'JSON')) issues.push(t('Ce type ne peut pas servir d’identifiant dans cet export : {0}.{1}.', [table.name, column.name]))
    if (column.references) {
      const target = tables.find(candidate => candidate.id === column.references?.tableId)?.columns.find(c => c.name === column.references?.columnName)
      const targetSpec = target && parseSqlType(target.sqlType)
      if (targetSpec && formatSqlType(spec) !== formatSqlType(targetSpec)) issues.push(t('Types de clé étrangère différents : {0}.{1}.', [table.name, column.name]))
    }
  }
  return issues
}
