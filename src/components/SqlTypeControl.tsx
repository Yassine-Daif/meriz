import { useEffect, useState } from 'react'
import type { Property } from '../model/mcd'
import { defaultSqlSpec, formatSqlType, hasLength, hasPrecision, parseSqlType, sqlTypeForDialect, sqlTypeNames } from '../model/sqlTypes'
import type { SqlTypeSpec } from '../model/sqlTypes'
import { useSqlTypes } from './sqlTypesContext'
import { t } from '../i18n/runtime'
import { useLanguage } from '../lib/useLanguage'

const field = 'min-w-0 max-w-full rounded-control border border-line-strong bg-surface px-2 py-1 font-mono text-xs'

/** Les paramètres incomplets restent locaux ; seules les valeurs validées partent au direct. */
export function SqlTypeControl({ property, compact = false }: { property: Pick<Property, 'id' | 'name' | 'type' | 'size'>; compact?: boolean }) {
  useLanguage()
  const { settings, dispatch, readOnly, physicalType } = useSqlTypes()
  const raw = physicalType(property.id, property.type, property.size)
  const spec = parseSqlType(raw)
  const [draft, setDraft] = useState({ length: '', precision: '', scale: '', values: '' })
  const [error, setError] = useState('')
  useEffect(() => {
    const value = parseSqlType(raw)
    setDraft({ length: String(value?.length ?? ''), precision: String(value?.precision ?? ''), scale: String(value?.scale ?? ''), values: value?.values?.join('\n') ?? '' }); setError('')
  }, [raw])
  const apply = (value: SqlTypeSpec) => {
    if (readOnly) return
    const sql = formatSqlType(value)
    if (!parseSqlType(sql) || !sqlTypeForDialect(value, settings.dialect)) { setError(t('Paramètres SQL invalides.')); return }
    setError(''); dispatch({ type: 'SET_SQL_TYPE', propertyId: property.id, value: sql })
  }
  const number = (key: 'length' | 'precision' | 'scale', label: string, min: number, max: number) => <label className="flex min-w-0 flex-col gap-1 text-xs text-ink-soft"><span>{label}</span><input className={field + ' w-24'} type="number" min={min} max={max} disabled={readOnly} value={draft[key]} aria-label={label + ' — ' + property.name} aria-invalid={!!error}
    onChange={event => setDraft(value => ({ ...value, [key]: event.target.value }))}
    onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }}
    onBlur={() => { if (spec) apply({ ...spec, [key]: draft[key].trim() ? Number(draft[key]) : -1 }) }} /></label>
  return <div className="flex min-w-0 flex-col gap-2" data-sql-type={property.id}>
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <select value={spec?.name ?? raw} disabled={readOnly} aria-label={t('Type de la propriété {0}', [property.name])} className={field + ' flex-1'}
        onChange={event => { const name = sqlTypeNames(settings.dialect).find(n => n === event.target.value); if (name) apply(defaultSqlSpec(name)) }}>
        {(!spec || !sqlTypeNames(settings.dialect).includes(spec.name)) && <option value={spec?.name ?? raw}>{raw}</option>}
        {[true, false].map(common => <optgroup key={String(common)} label={common ? t('Types courants') : t('Types complémentaires')}>{sqlTypeNames(settings.dialect).filter(name => ['VARCHAR', 'TEXT', 'INT', 'INTEGER', 'BIGINT', 'DECIMAL', 'NUMERIC', 'BOOLEAN', 'DATE', 'TIME', 'DATETIME', 'TIMESTAMP'].includes(name) === common).map(name => <option key={name} value={name}>{name}</option>)}</optgroup>)}
      </select>
      {!compact && raw !== spec?.name && <code className="min-w-0 basis-full break-all text-xs text-ink-soft">{raw}</code>}
    </div>
    <div className="flex min-w-0 flex-wrap gap-2">
      {spec && hasLength(spec.name) && number('length', t('Longueur'), 1, spec.name === 'CHAR' ? 255 : 65535)}
      {spec && hasPrecision(spec.name) && <>{number('precision', t('Précision'), 1, settings.dialect === 'mysql' ? 65 : 1000)}{number('scale', t('Décimales'), 0, settings.dialect === 'mysql' ? 30 : 1000)}</>}
      {settings.dialect === 'mysql' && spec && ['INT', 'BIGINT', 'SMALLINT', 'TINYINT'].includes(spec.name) && <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!spec.unsigned} disabled={readOnly} onChange={e => apply({ ...spec, unsigned: e.target.checked || undefined })} />UNSIGNED</label>}
      {spec?.name === 'ENUM' && <label className="flex w-full min-w-0 flex-col gap-1 text-xs text-ink-soft">{t('Une valeur par ligne')}<textarea className={field + ' w-full'} rows={3} disabled={readOnly} value={draft.values} onChange={e => setDraft(d => ({ ...d, values: e.target.value }))} onBlur={() => apply({ ...spec, values: draft.values.split('\n') })} /></label>}
    </div>
    {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    {(!spec || !sqlTypeNames(settings.dialect).includes(spec.name)) && <p className="text-xs text-warning">{t('Type à vérifier pour le moteur choisi.')}</p>}
  </div>
}
