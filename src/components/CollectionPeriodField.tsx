import { useState } from 'react'
import { Select } from './ui/Select'
import { t } from '../i18n/runtime'
import { useLanguage } from '../lib/useLanguage'
import { currentAcademicYear } from '../lib/collectionPeriod'
import type { PeriodKind } from '../lib/collectionPeriod'

export function CollectionPeriodField({
  year,
  kind,
  onChange,
  optional = true,
  disabled = false,
  lockedKind = false,
}: {
  year: number | null
  kind: PeriodKind
  onChange: (year: number | null, kind: PeriodKind) => void
  optional?: boolean
  disabled?: boolean
  lockedKind?: boolean
}) {
  useLanguage()
  const [custom, setCustom] = useState(false),
    [customYear, setCustomYear] = useState(
      String(year ?? new Date().getFullYear()),
    )
  const now = new Date().getFullYear()
  const years = [
    ...new Set([
      ...(year === null ? [] : [year]),
      ...Array.from({ length: 12 }, (_, i) => now + 3 - i),
    ]),
  ].sort((a, b) => b - a)
  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
      <label className="flex min-w-0 flex-col gap-1 text-sm">
        {t('Type de période')}
        <Select
          disabled={disabled || lockedKind}
          value={year === null ? 'none' : kind}
          onValueChange={(value) =>
            onChange(
              value === 'none'
                ? null
                : (year ??
                    (value === 'academic' ? currentAcademicYear() : now)),
              value === 'calendar' ? 'calendar' : 'academic',
            )
          }
        >
          {optional && <option value="none">{t('Sans période')}</option>}
          <option value="academic">{t('Année scolaire')}</option>
          <option value="calendar">{t('Année civile')}</option>
        </Select>
      </label>
      {year !== null && (
        <label className="flex min-w-0 flex-col gap-1 text-sm">
          {t('Période')}
          <Select
            disabled={disabled}
            value={custom ? 'other' : String(year)}
            onValueChange={(value) => {
              if (value === 'other') {
                setCustom(true)
                setCustomYear(String(year))
              } else {
                setCustom(false)
                onChange(Number(value), kind)
              }
            }}
          >
            {years.map((y) => (
              <option key={y} value={String(y)}>
                {kind === 'academic' ? y + '-' + (y + 1) : y}
              </option>
            ))}
            <option value="other">{t('Autre période…')}</option>
          </Select>
        </label>
      )}
      {custom && year !== null && (
        <label className="flex min-w-0 flex-col gap-1 text-sm">
          {t('Année de début')}
          <input
            type="number"
            required
            disabled={disabled}
            min={1900}
            max={2200}
            value={customYear}
            onChange={(e) => {
              setCustomYear(e.target.value)
              const n = Number(e.target.value)
              if (n >= 1900 && n <= 2200) onChange(n, kind)
            }}
            className="min-w-0 rounded-control border border-line-strong bg-surface px-3 py-2"
          />
          <span className="text-xs text-ink-soft">
            {kind === 'academic' ? year + '-' + (year + 1) : year}
          </span>
        </label>
      )}
    </div>
  )
}
