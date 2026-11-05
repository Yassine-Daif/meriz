import type { useCollections } from './useCollections'
import { periodKey, periodLabel } from '../lib/collectionPeriod'
import { t } from '../i18n/runtime'
import { useLanguage } from '../lib/useLanguage'
import { Select } from './ui/Select'
import { Button } from './ui/Button'

export function CollectionFilters({
  organizer,
  items,
}: {
  organizer: ReturnType<typeof useCollections>
  items: readonly { id: string }[]
}) {
  useLanguage()
  const periods = [
    ...new Map(
      [...organizer.collections]
        .sort((a, b) => (b.yearStart ?? 0) - (a.yearStart ?? 0))
        .filter((c) => c.yearStart !== null)
        .map((c) => [periodKey(c), periodLabel(c)]),
    ).entries(),
  ]
  const archived = new Set(
    organizer.collections.filter((c) => c.archived).flatMap((c) => c.itemIds),
  )
  const active = new Set(
    organizer.collections.filter((c) => !c.archived).flatMap((c) => c.itemIds),
  )
  const hidden = items.filter(
    (item) => archived.has(item.id) && !active.has(item.id),
  ).length
  const reset = () => {
    organizer.setSelection('all')
    organizer.setYear('all')
    organizer.setArchive('active')
  }
  return (
    <div className="mb-4 space-y-2" aria-label={t('Filtres des espaces')}>
      <div className="flex min-w-0 flex-wrap items-end gap-3">
        <label className="flex min-w-0 flex-1 basis-48 flex-col gap-1 text-xs">
          {t('Regroupement')}
          <Select
            value={organizer.selection}
            onValueChange={(value) => {
              organizer.setSelection(value)
              const c = organizer.collections.find((c) => c.id === value)
              if (c) {
                organizer.setYear('all')
                organizer.setArchive(c.archived ? 'archived' : 'active')
              }
            }}
          >
            <option value="all">{t('Tous les regroupements')}</option>
            <option value="unassigned">{t('Sans regroupement')}</option>
            {organizer.collections.map((c) => (
              <option key={c.id} value={c.id}>
                {[periodLabel(c), c.name, c.archived ? t('Archivé') : '']
                  .filter(Boolean)
                  .join(' · ')}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex min-w-0 flex-1 basis-44 flex-col gap-1 text-xs">
          {t('Période')}
          <Select
            value={organizer.year}
            onValueChange={(value) => {
              organizer.setYear(value)
              organizer.setSelection('all')
            }}
          >
            <option value="all">{t('Toutes les périodes')}</option>
            {periods.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
            <option value="null">{t('Sans période')}</option>
          </Select>
        </label>
        <label className="flex min-w-0 flex-1 basis-32 flex-col gap-1 text-xs">
          {t('Afficher')}
          <Select
            value={organizer.archive}
            onValueChange={(value) => {
              organizer.setArchive(value)
              organizer.setSelection('all')
            }}
          >
            <option value="active">{t('Actifs')}</option>
            <option value="archived">{t('Archivés')}</option>
            <option value="all">{t('Tout')}</option>
          </Select>
        </label>
        <Button size="sm" variant="ghost" onClick={reset}>
          {t('Réinitialiser les filtres')}
        </Button>
      </div>
      {hidden > 0 && organizer.archive === 'active' && (
        <p className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
          {t('Des espaces sont classés dans les archives : {0}.', [hidden])}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              organizer.setArchive('archived')
              organizer.setYear('all')
              organizer.setSelection('all')
            }}
          >
            {t('Voir les archives')}
          </Button>
        </p>
      )}
      {organizer.error && (
        <p role="alert" className="text-sm text-danger">
          {organizer.error}
          <Button size="sm" onClick={organizer.reload}>
            {t('Réessayer')}
          </Button>
        </p>
      )}
    </div>
  )
}
