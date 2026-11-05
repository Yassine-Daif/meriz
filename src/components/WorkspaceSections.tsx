import { periodLabel } from '../lib/collectionPeriod'
import type { ReactNode } from 'react'
import type { WorkspaceCollection } from '../lib/collectionsApi'
import { workspaceSections } from '../lib/collectionsApi'
import { t } from '../i18n/runtime'
import { useLanguage } from '../lib/useLanguage'

export function WorkspaceSections<T extends { id: string }>({
  items,
  collections,
  render,
}: {
  items: readonly T[]
  collections: readonly WorkspaceCollection[]
  render: (items: readonly T[]) => ReactNode
}) {
  useLanguage()
  if (collections.length === 0) return render(items)
  return (
    <div className="space-y-6">
      {workspaceSections(items, collections).map((section) => (
        <section
          key={section.collection?.id ?? 'unassigned'}
          className="space-y-3"
        >
          <h3 className="min-w-0 break-words text-sm font-semibold">
            {section.collection ? (
              <>
                {section.collection.yearStart !== null && (
                  <span className="mr-2 text-ink-soft">
                    {periodLabel(section.collection)}
                  </span>
                )}
                {section.collection.name}
              </>
            ) : (
              t('Sans regroupement')
            )}
          </h3>
          {render(section.items)}
        </section>
      ))}
    </div>
  )
}
