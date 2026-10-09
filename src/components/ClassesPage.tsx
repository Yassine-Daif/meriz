import { useCallback, useMemo, useState } from 'react'
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
import { PageShell } from './PageShell'
import { SearchField } from './ui/SearchField'
import { Card } from './ui/Card'

/** Classe à ouvrir en détail, avec son contenu s'il est déjà connu. */
/** En dessous de ce nombre, une recherche encombre plus qu'elle n'aide. */
const SEARCH_FROM = 6

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
  const classrooms = useClassrooms(client)
  const { reload } = classrooms
  const [selected, setSelected] = useState<ClassroomOpening | null>(opening)
  const [status, setStatus] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const canCreate = user.role === 'teacher'

  const open = (next: ClassroomOpening) => {
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
  const shown = useMemo(() => (all === null ? [] : filterByName(all, searching ? query : '')), [all, query, searching])
  const filtered = all === null ? classrooms : { ...classrooms, classrooms: shown }

  if (selected) {
    return (
      <PageShell title="Classe" focusKey={selected.id} onBack={() => backToList(null)} backLabel="Retour à mes classes">
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
      title="Mes classes"
      description={
        canCreate
          ? 'Créez une classe et partagez son code, ou rejoignez celle d’un collègue.'
          : 'Rejoignez une classe avec le code donné par votre prof.'
      }
    >
      <p role="status" aria-live="polite" className="min-h-5 text-sm">
        {status && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sage-soft px-3 py-1 text-ink">
            <span aria-hidden="true" className="text-sage">
              ✓
            </span>
            {status}
          </span>
        )}
      </p>

      <div className={`mt-3 grid gap-4 ${canCreate ? 'md:grid-cols-2' : 'md:max-w-md'}`}>
        <Card as="section" aria-labelledby="rejoindre-titre">
          <h2 id="rejoindre-titre" className="text-base font-semibold text-ink">
            Rejoindre une classe
          </h2>
          <div className="mt-3">
            <JoinClassForm
              client={client}
              onJoined={(classroom) =>
                open({ id: classroom.id, initial: classroom, message: `Vous avez rejoint la classe « ${classroom.name} ».` })
              }
            />
          </div>
        </Card>

        {canCreate && (
          <Card as="section" aria-labelledby="creer-titre">
            <h2 id="creer-titre" className="text-base font-semibold text-ink">
              Créer une classe
            </h2>
            <div className="mt-3">
              <CreateClassForm
                client={client}
                onCreated={(classroom) =>
                  open({
                    id: classroom.id,
                    initial: classroom,
                    message: `Classe « ${classroom.name} » créée. Partagez son code à vos élèves.`,
                  })
                }
              />
            </div>
          </Card>
        )}
      </div>

      <section aria-labelledby="liste-titre" className="mt-8">
        <h2 id="liste-titre" className="text-lg font-semibold tracking-tight text-ink">
          Vos classes
          {total > 0 && <span className="font-normal text-ink-soft"> ({total})</span>}
        </h2>
        {searchable && (
          <div className="mt-3 max-w-md">
            <SearchField
              label="Rechercher une classe"
              value={query}
              onChange={setQuery}
              placeholder="Nom de la classe"
              count={searchCountLabel(shown.length, total, 'classe', 'classes')}
            />
          </div>
        )}
        <div className="mt-3">
          <ClassroomGrid
            state={filtered}
            onOpen={(classroom) => setSelected({ id: classroom.id, initial: null, message: null })}
            emptyText={
              searching
                ? 'Aucune classe ne porte ce nom. Essayez un autre mot, ou effacez la recherche.'
                : canCreate
                  ? 'Aucune classe pour l’instant : créez-en une, ou rejoignez celle d’un collègue.'
                  : 'Aucune classe pour l’instant : saisissez le code donné par votre prof.'
            }
          />
        </div>
      </section>
    </PageShell>
  )
}
