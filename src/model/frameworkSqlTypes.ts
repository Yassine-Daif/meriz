import { formatSqlType, parseSqlType } from './sqlTypes'
import type { SqlDialect } from './mpd'
import type { SchemaColumn } from './codeSchema'
import { phpString, phpStringList } from './php'
import { t } from '../i18n/runtime'

export function columnSqlSpec(column: SchemaColumn) {
  const spec = parseSqlType(column.sqlType)
  if (!spec) throw new Error(t('Type SQL non pris en charge pour cet export : {0}.', [column.sqlType]))
  return spec
}

/** Les migrations utilisent le type physique choisi, jamais une approximation conceptuelle. */
export function blueprintColumn(column: SchemaColumn): string {
  const spec = columnSqlSpec(column), name = phpString(column.columnName)
  let call: string
  switch (spec.name) {
    case 'VARCHAR': call = `string(${name}, ${spec.length})`; break
    case 'CHAR': call = `char(${name}, ${spec.length})`; break
    case 'TEXT': call = `text(${name})`; break
    case 'INT': case 'INTEGER': call = `integer(${name})`; break
    case 'BIGINT': call = `bigInteger(${name})`; break
    case 'SMALLINT': call = `smallInteger(${name})`; break
    case 'TINYINT': call = `tinyInteger(${name})`; break
    case 'DECIMAL': case 'NUMERIC': call = `decimal(${name}, ${spec.precision}, ${spec.scale})`; break
    case 'FLOAT': case 'REAL': call = `float(${name}, precision: 24)`; break
    case 'DOUBLE': case 'DOUBLE PRECISION': call = `double(${name})`; break
    case 'BOOLEAN': call = `boolean(${name})`; break
    case 'DATE': call = `date(${name})`; break
    case 'TIME': call = `time(${name})`; break
    case 'DATETIME': call = `dateTime(${name})`; break
    case 'TIMESTAMP': call = `timestamp(${name})`; break
    case 'TIMESTAMP WITH TIME ZONE': call = `timestampTz(${name})`; break
    case 'UUID': call = `uuid(${name})`; break
    case 'JSON': call = `json(${name})`; break
    case 'JSONB': call = `jsonb(${name})`; break
    case 'VARBINARY': call = `binary(${name}, length: ${spec.length})`; break
    case 'BLOB': case 'BYTEA': call = `binary(${name})`; break
    case 'ENUM': call = spec.values?.some(value => value.includes("'")) ? `rawColumn(${name}, ${phpString(formatSqlType(spec))})` : `enum(${name}, ${phpStringList(spec.values ?? [])})`; break
  }
  return `$table->${call}${spec.unsigned ? '->unsigned()' : ''}`
}

export interface DoctrineColumnFormat { attribute: string; phpType: string; needsTypes: boolean }
export function doctrineColumn(column: SchemaColumn, dialect: SqlDialect = 'mysql'): DoctrineColumnFormat {
  const spec = columnSqlSpec(column)
  let type: string, phpType: string, parameters: string[] = []
  switch (spec.name) {
    case 'VARCHAR': case 'CHAR': type = 'STRING'; phpType = 'string'; parameters.push(`length: ${spec.length}`); break
    case 'TEXT': type = 'TEXT'; phpType = 'string'; if (dialect === 'mysql') parameters.push('length: 65535'); break
    case 'INT': case 'INTEGER': type = 'INTEGER'; phpType = 'int'; break
    case 'BIGINT': type = 'BIGINT'; phpType = 'int|string'; break
    case 'SMALLINT': case 'TINYINT': type = 'SMALLINT'; phpType = 'int'; break
    case 'NUMERIC': case 'DECIMAL': type = 'DECIMAL'; phpType = 'string'; parameters.push(`precision: ${spec.precision}`, `scale: ${spec.scale}`); break
    case 'REAL': case 'FLOAT': type = 'SMALLFLOAT'; phpType = 'float'; break
    case 'DOUBLE': case 'DOUBLE PRECISION': type = 'FLOAT'; phpType = 'float'; break
    case 'BOOLEAN': type = 'BOOLEAN'; phpType = 'bool'; break
    case 'DATE': type = 'DATE_MUTABLE'; phpType = '\\DateTimeInterface'; break
    case 'TIME': type = 'TIME_MUTABLE'; phpType = '\\DateTimeInterface'; break
    case 'DATETIME': case 'TIMESTAMP': type = 'DATETIME_MUTABLE'; phpType = '\\DateTimeInterface'; break
    case 'TIMESTAMP WITH TIME ZONE': type = 'DATETIMETZ_MUTABLE'; phpType = '\\DateTimeInterface'; break
    case 'UUID': type = 'GUID'; phpType = 'string'; break
    case 'JSON': type = 'JSON'; phpType = 'mixed'; break
    case 'JSONB': type = 'JSONB'; phpType = 'mixed'; break
    case 'VARBINARY': type = 'BINARY'; phpType = 'string'; parameters.push(`length: ${spec.length}`); break
    case 'BLOB': type = 'BLOB'; phpType = 'mixed'; parameters.push('length: 65535'); break
    case 'BYTEA': type = 'BLOB'; phpType = 'mixed'; break
    case 'ENUM': type = 'ENUM'; phpType = 'string'; break
  }
  const options: string[] = []
  if (spec.name === 'CHAR') options.push("'fixed' => true")
  if (spec.unsigned) options.push("'unsigned' => true")
  if (spec.name === 'ENUM') options.push("'values' => " + phpStringList(spec.values ?? []))
  if (options.length) parameters.push(`options: [${options.join(', ')}]`)
  // Ces types natifs n'ont pas une correspondance portable univoque dans DBAL.
  if (['TINYINT', 'TIMESTAMP', 'TIMESTAMP WITH TIME ZONE'].includes(spec.name)) parameters.push(`columnDefinition: ${phpString(column.sqlType + (column.nullable ? '' : ' NOT NULL'))}`)
  return { attribute: [`type: Types::${type}`, ...parameters].join(', '), phpType, needsTypes: true }
}

export const nullablePhpType = (type: string) => type === 'mixed' ? 'mixed' : type.includes('|') ? type + '|null' : '?' + type

export function eloquentCast(column: SchemaColumn): string | null {
  const spec = columnSqlSpec(column)
  if (spec.name === 'JSON' || spec.name === 'JSONB') return 'array'
  if (spec.name === 'BOOLEAN') return 'boolean'
  if (spec.name === 'DECIMAL' || spec.name === 'NUMERIC') return 'decimal:' + spec.scale
  if (['FLOAT', 'REAL', 'DOUBLE', 'DOUBLE PRECISION'].includes(spec.name)) return 'float'
  if (spec.name === 'DATE') return 'date'
  if (['DATETIME', 'TIMESTAMP', 'TIMESTAMP WITH TIME ZONE'].includes(spec.name)) return 'datetime'
  return null
}
