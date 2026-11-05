import { t } from '../i18n/runtime'
import { useLanguage } from '../lib/useLanguage'
import { useCallback, useId, useState } from 'react'
import type { ApiClient } from '../lib/apiClient'
import type { ApiUser } from '../lib/authApi'
import type { ClassroomDetail } from '../lib/classroomsApi'
import { filterByName, searchCountLabel } from '../lib/searchFilter'
import { useClassrooms } from '../lib/useClassrooms'
import { ClassroomGrid } from './ClassroomGrid'
import { ClassroomView } from './ClassroomView'
import type { ClassroomTab } from './ClassroomView'
import type { AssignmentTab } from './assignments/AssignmentWorkspace'
import type {
  EditAssignmentModel,
  OpenLiveCoedition,
  OpenReadOnlyModel,
  OpenWorkDocument,
} from './assignments/types'
import { CreateClassForm } from './CreateClassForm'
import { JoinClassForm } from './JoinClassForm'
import { TeachingLibraryPanel } from './TeachingLibraryPanel'
import { Tabs, TabPanel } from './ui/Tabs'
import { CollectionFilters } from './CollectionFilters'
import { periodKey } from '../lib/collectionPeriod'
import { CollectionOrganizer } from './CollectionOrganizer'
import { useCollections } from './useCollections'
import { PageShell } from './PageShell'
import { Card } from './ui/Card'
import { SearchField } from './ui/SearchField'

/** En dessous de ce nombre, une recherche encombre plus qu'elle n'aide. */
const SEARCH_FROM = 0

/** Classe à ouvrir en détail, avec son contenu s'il est déjà connu. */
export interface ClassroomOpening {
  id: string
  initial: ClassroomDetail | null
  /** Message annoncé à l'ouverture (ex. « Vous avez rejoint… »). */
  message: string | null
  /** Devoir à rouvrir dans l'onglet Exercices (retour de l'outil MCD). */
  assignmentId?: string
  /** Rendu à rouvrir dans ce devoir (retour d'une consultation). */
  submissionId?: string
  /** Section du devoir rouvert, quand ce n'est pas l'énoncé. */
  assignmentTab?: AssignmentTab
  /** Onglet d'arrivée, quand on vient d'un raccourci de l'accueil. */
  tab?: ClassroomTab
}

interface ClassesPageProps {
  user: ApiUser
  /** Ouvre l'outil MCD sur la base ou le corrigé d'un devoir. */
  onEditAssignmentModel: EditAssignmentModel
  /** Ouvre l'outil MCD sur le travail d'un élève pour un devoir. */
  onOpenWorkDocument: OpenWorkDocument
  /** Ouvre l'outil MCD en consultation (rendu d'un élève, corrigé libéré). */
  onOpenReadOnlyModel: OpenReadOnlyModel
  /** Corriger en direct le travail d'un élève, en co-édition. */
  onStartLiveCoedition: OpenLiveCoedition
  /** Client lié au compte connecté. */
  client: ApiClient
  /** Classe à ouvrir d'emblée (depuis l'accueil). */
  opening?: ClassroomOpening | null
}

/**
 * Mes classes : rejoindre par code, et, pour un compte prof, créer une
 * classe. Une classe choisie s'ouvre en détail. Rien n'est gardé dans le
 * navigateur : tout est relu auprès du serveur pour le compte connecté.
 */
export function ClassesPage({
  user,
  client,
  opening = null,
  onEditAssignmentModel,
  onOpenWorkDocument,
  onOpenReadOnlyModel,
  onStartLiveCoedition,
}: ClassesPageProps) {
  useLanguage()
  const organizer = useCollections(client, 'classrooms')
  const classrooms = useClassrooms(client)
  const { reload } = classrooms
  const [selected, setSelected] = useState<ClassroomOpening | null>(opening)
  const [status, setStatus] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const [pageTab, setPageTab] = useState<
    'list' | 'organize' | 'create' | 'join' | 'library'
  >('list')
  const tabsId = useId()
  const canCreate = user.role === 'teacher'

  const open = (next: ClassroomOpening) => {
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

  /*
   * La recherche ne touche ni au chargement ni à l'erreur : on dérive un
   * état filtré seulement quand la liste est arrivée, et la grille garde
   * ses trois chemins. Le champ n'apparaît qu'au-delà du seuil : sous six
   * classes, il encombrerait plus qu'il n'aiderait.
   */
  const all = classrooms.classrooms
  const total = all?.length ?? 0
  const searchable = total > SEARCH_FROM
  const searching = searchable && query.trim() !== ''
  const shown = canCreate
    ? organizer.filter(all ?? [], query)
    : all === null
      ? []
      : filterByName(all, searching ? query : '')
  const filtered =
    all === null ? classrooms : { ...classrooms, classrooms: shown }

  if (selected) {
    return (
      <PageShell
        title={t('Classe')}
        focusKey={selected.id}
        onBack={() => backToList(null)}
        backLabel={t('Retour à mes classes')}
      >
        <ClassroomView
          key={selected.id}
          client={client}
          classroomId={selected.id}
          initial={selected.initial}
          openAssignmentId={selected.assignmentId ?? null}
          openSubmissionId={selected.submissionId ?? null}
          openAssignmentTab={selected.assignmentTab ?? null}
          openTab={selected.tab ?? null}
          onEditAssignmentModel={onEditAssignmentModel}
          onOpenWorkDocument={onOpenWorkDocument}
          onOpenReadOnlyModel={onOpenReadOnlyModel}
          onStartLiveCoedition={onStartLiveCoedition}
          onGone={(message) => backToList(message)}
          initialStatus={selected.message}
        />
      </PageShell>
    )
  }

  return (
    <PageShell
      title={t('Mes classes')}
      description={
        canCreate
          ? t('Retrouvez vos classes et organisez-les par regroupement.')
          : t('Rejoignez une classe avec le code donné par votre prof.')
      }
    >
      <Tabs
        idBase={tabsId}
        label={t('Navigation des classes')}
        value={pageTab}
        onChange={setPageTab}
        items={[
          { value: 'list', label: t('Mes classes'), count: total },
          ...(canCreate
            ? [
                { value: 'organize' as const, label: t('Regroupements') },
                { value: 'create' as const, label: t('Créer une classe') },
              ]
            : []),
          { value: 'join', label: t('Rejoindre une classe') },
          ...(canCreate
            ? [
                {
                  value: 'library' as const,
                  label: t('Bibliothèque pédagogique'),
                },
              ]
            : []),
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
              {t('Rejoindre une classe')}
            </h2>
            <JoinClassForm
              client={client}
              onJoined={(classroom) =>
                open({
                  id: classroom.id,
                  initial: classroom,
                  message: t('Vous avez rejoint la classe « {0} ».', [
                    classroom.name,
                  ]),
                })
              }
            />
          </Card>
        )}
        {pageTab === 'create' && canCreate && (
          <Card as="section" className="max-w-xl">
            <h2 className="mb-3 text-base font-semibold">
              {t('Créer une classe')}
            </h2>
            <CreateClassForm
              client={client}
              onCreated={(classroom) =>
                open({
                  id: classroom.id,
                  initial: classroom,
                  message: t(
                    'Classe « {0} » créée. Partagez son code à vos élèves.',
                    [classroom.name],
                  ),
                  tab: 'reglages',
                })
              }
            />
          </Card>
        )}
        {pageTab === 'library' && canCreate && (
          <TeachingLibraryPanel client={client} classrooms={all ?? []} />
        )}
        {pageTab === 'organize' &&
          canCreate &&
          (all === null ? (
            <ClassroomGrid state={classrooms} onOpen={() => {}} emptyText="" />
          ) : (
            <CollectionOrganizer
              onSpacesChanged={() => void reload()}
              client={client}
              kind="classrooms"
              organizer={organizer}
              items={all.filter((c) => c.myRole === 'teacher')}
              onOpen={(id) => setSelected({ id, initial: null, message: null })}
            />
          ))}
        {pageTab === 'list' && (
          <section aria-label={t('Vos classes')} className="space-y-4">
            {searchable && (
              <div className="max-w-xl">
                <SearchField
                  label={t('Rechercher une classe')}
                  value={query}
                  onChange={setQuery}
                  placeholder={t('Nom de la classe')}
                  count={searchCountLabel(
                    shown.length,
                    total,
                    'classe',
                    'classes',
                  )}
                />
              </div>
            )}
            {canCreate && (
              <CollectionFilters organizer={organizer} items={all ?? []} />
            )}
            <ClassroomGrid
              state={filtered}
              collections={
                canCreate
                  ? organizer.collections.filter(
                      (c) =>
                        (organizer.year === 'all' ||
                          periodKey(c) === organizer.year) &&
                        (organizer.archive === 'all' ||
                          c.archived === (organizer.archive === 'archived')),
                    )
                  : []
              }
              onOpen={(classroom) =>
                setSelected({ id: classroom.id, initial: null, message: null })
              }
              emptyText={
                total > 0
                  ? t(
                      'Aucun résultat avec ces filtres. Réinitialisez-les ou consultez les archives.',
                    )
                  : canCreate
                    ? t(
                        'Aucune classe pour l’instant. Utilisez les onglets Créer ou Rejoindre pour commencer.',
                      )
                    : t(
                        'Aucune classe pour l’instant : saisissez le code donné par votre prof.',
                      )
              }
            />
          </section>
        )}
      </TabPanel>
    </PageShell>
  )
}
