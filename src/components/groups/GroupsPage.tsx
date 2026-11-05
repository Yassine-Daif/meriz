import { t } from '../../i18n/runtime'
import { useLanguage } from '../../lib/useLanguage'
import { useCallback, useId, useState } from 'react'
import type { ApiClient } from '../../lib/apiClient'
import { formatJoinCode } from '../../lib/classroomsApi'
import { copyText } from '../../lib/clipboard'
import type { GroupDetail } from '../../lib/groupsApi'
import { searchCountLabel } from '../../lib/searchFilter'
import { useGroups } from '../../lib/useGroups'
import { Tabs, TabPanel } from '../ui/Tabs'
import { CollectionFilters } from '../CollectionFilters'
import { periodKey } from '../../lib/collectionPeriod'
import { CollectionOrganizer } from '../CollectionOrganizer'
import { useCollections } from '../useCollections'
import { PageShell } from '../PageShell'
import { SearchField } from '../ui/SearchField'
import { Card } from '../ui/Card'
import { CreateGroupForm } from './CreateGroupForm'
import type { OpenGroupDocument } from './GroupDocumentsPanel'
import { GroupGrid } from './GroupGrid'
import { GroupView } from './GroupView'
import type { GroupTab } from './GroupView'
import { JoinGroupForm } from './JoinGroupForm'

/** En dessous de ce nombre, une recherche encombre plus qu'elle n'aide. */
const SEARCH_FROM = 0

/** Ce qu'il faut pour rouvrir un groupe, au retour de l'outil MCD. */
export interface GroupOpening {
  id: string
  /** Groupe déjà connu, affiché sans attendre le serveur. */
  initial: GroupDetail | null
  message: string | null
  tab?: GroupTab | null
}

interface GroupsPageProps {
  client: ApiClient
  opening?: GroupOpening | null
  onOpenGroupDocument: OpenGroupDocument
}

/**
 * Mes groupes : en créer un, en rejoindre un par code, et ouvrir ceux
 * dont je fais partie. C'est entre élèves, sans prof ni note : chacun
 * travaille avec les autres sur les documents du groupe.
 */
export function GroupsPage({
  client,
  opening = null,
  onOpenGroupDocument,
}: GroupsPageProps) {
  useLanguage()
  const organizer = useCollections(client, 'groups')
  const groups = useGroups(client)
  const { reload } = groups
  const [selected, setSelected] = useState<GroupOpening | null>(opening)
  const [status, setStatus] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const [pageTab, setPageTab] = useState<
    'list' | 'organize' | 'create' | 'join'
  >('list')
  const tabsId = useId()
  const open = (next: GroupOpening) => {
    setPageTab('list')
    organizer.setSelection('all')
    organizer.setYear('all')
    organizer.setArchive('active')
    setQuery('')
    setSelected(next)
    void reload()
  }

  const backToList = useCallback(
    (message: string | null) => {
      setSelected(null)
      setStatus(message)
      void reload()
    },
    [reload],
  )

  const copyCode = async (code: string) => {
    const copied = await copyText(formatJoinCode(code))
    setStatus(
      copied
        ? t('Code {0} copié dans le presse-papiers.', [formatJoinCode(code)])
        : t(
            'Copie impossible dans ce navigateur : ouvrez le groupe pour lire son code.',
          ),
    )
  }

  // Même dérivation que sur Mes classes : l'état filtré ne se construit
  // qu'une fois la liste arrivée, pour que la grille garde ses trois
  // chemins, chargement, erreur et vide.
  const all = groups.groups
  const total = all?.length ?? 0
  const searchable = total > SEARCH_FROM
  const shown = all === null ? [] : organizer.filter(all, query)
  const filtered = all === null ? groups : { ...groups, groups: shown }

  if (selected) {
    return (
      <PageShell
        title={t('Groupe')}
        focusKey={selected.id}
        onBack={() => backToList(null)}
        backLabel={t('Retour à mes groupes')}
      >
        <GroupView
          key={selected.id}
          client={client}
          groupId={selected.id}
          initial={selected.initial}
          initialStatus={selected.message}
          openTab={selected.tab ?? null}
          onGone={(message) => backToList(message)}
          onOpenGroupDocument={onOpenGroupDocument}
        />
      </PageShell>
    )
  }

  return (
    <PageShell
      title={t('Mes groupes')}
      description={t(
        'Retrouvez vos groupes et organisez vos espaces de collaboration.',
      )}
    >
      <Tabs
        idBase={tabsId}
        label={t('Navigation des groupes')}
        value={pageTab}
        onChange={setPageTab}
        items={[
          { value: 'list', label: t('Mes groupes'), count: total },
          { value: 'organize', label: t('Regroupements') },
          { value: 'create', label: t('Créer un groupe') },
          { value: 'join', label: t('Rejoindre un groupe') },
        ]}
      />
      {status && (
        <p role="status" className="mt-3 text-sm text-ink-soft">
          {status}
        </p>
      )}
      <TabPanel idBase={tabsId} value={pageTab}>
        {pageTab === 'join' && (
          <Card as="section" className="max-w-xl">
            <h2 className="mb-3 text-base font-semibold">
              {t('Rejoindre un groupe')}
            </h2>
            <JoinGroupForm
              client={client}
              onJoined={(group) =>
                open({
                  id: group.id,
                  initial: group,
                  message: t('Vous avez rejoint le groupe « {0} ».', [
                    group.name,
                  ]),
                })
              }
            />
          </Card>
        )}
        {pageTab === 'create' && (
          <Card as="section" className="max-w-xl">
            <h2 className="mb-3 text-base font-semibold">
              {t('Créer un groupe')}
            </h2>
            <CreateGroupForm
              client={client}
              onCreated={(group) =>
                open({
                  id: group.id,
                  initial: group,
                  message: t(
                    'Groupe « {0} » créé. Partagez son code pour que les autres vous rejoignent.',
                    [group.name],
                  ),
                  tab: 'reglages',
                })
              }
            />
          </Card>
        )}
        {pageTab === 'organize' &&
          (all === null ? (
            <GroupGrid state={groups} onOpen={() => {}} emptyText="" />
          ) : (
            <CollectionOrganizer
              client={client}
              kind="groups"
              organizer={organizer}
              items={all}
              onOpen={(id) => setSelected({ id, initial: null, message: null })}
            />
          ))}
        {pageTab === 'list' && (
          <section aria-label={t('Vos groupes')} className="space-y-4">
            {searchable && (
              <div className="max-w-xl">
                <SearchField
                  label={t('Rechercher un groupe')}
                  value={query}
                  onChange={setQuery}
                  placeholder={t('Nom du groupe')}
                  count={searchCountLabel(
                    shown.length,
                    total,
                    'groupe',
                    'groupes',
                  )}
                />
              </div>
            )}
            <CollectionFilters organizer={organizer} items={all ?? []} />
            <GroupGrid
              state={filtered}
              collections={organizer.collections.filter(
                (c) =>
                  (organizer.year === 'all' ||
                    periodKey(c) === organizer.year) &&
                  (organizer.archive === 'all' ||
                    c.archived === (organizer.archive === 'archived')),
              )}
              onOpen={(group) =>
                setSelected({ id: group.id, initial: null, message: null })
              }
              onCopyCode={(code) => void copyCode(code)}
              emptyText={
                total > 0
                  ? t(
                      'Aucun résultat avec ces filtres. Réinitialisez-les ou consultez les archives.',
                    )
                  : t(
                      'Aucun groupe pour l’instant. Utilisez les onglets Créer ou Rejoindre pour commencer.',
                    )
              }
            />
          </section>
        )}
      </TabPanel>
    </PageShell>
  )
}
