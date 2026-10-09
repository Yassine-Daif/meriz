import { useState } from 'react'
import type { ApiClient, ApiError } from '../lib/apiClient'
import type { ApiUser } from '../lib/authApi'
import type { DocumentRepository } from '../lib/documentRepository'
import { plural } from '../lib/plural'
import { useClassrooms } from '../lib/useClassrooms'
import { useGroups } from '../lib/useGroups'
import { useMyAssignments } from '../lib/useMyAssignments'
import { pendingAssignments } from '../lib/workAssignments'
import type { ClassroomOpening } from './ClassesPage'
import { ClassShortcuts } from './ClassShortcuts'
import type { ClassShortcut } from './ClassShortcuts'
import { AttentionToDo } from './home/AttentionToDo'
import { QuickAccess } from './home/QuickAccess'
import { JoinClassForm } from './JoinClassForm'
import { PageShell } from './PageShell'
import { RecentDocuments } from './RecentDocuments'
import { Avatar } from './ui/Avatar'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { LiveAnnouncement } from './ui/LiveAnnouncement'
import { Notice } from './ui/Notice'
import { Stat } from './ui/Stat'

/** Là où un élève va le plus souvent, dans une de ses classes. */
const STUDENT_SHORTCUTS: readonly ClassShortcut[] = [
  {
    tab: 'exercices',
    label: 'Exercices',
    description: 'Les exercices et les examens donnés par votre prof, avec leur échéance et votre avancement.',
  },
  {
    tab: 'cours',
    label: 'Cours',
    description: 'Les supports publiés par votre prof, à lire à côté de l’outil de modélisation.',
  },
]

interface StudentHomeProps {
  user: ApiUser
  client: ApiClient
  repository: DocumentRepository
  onOpenDocument: (id: string) => Promise<ApiError | null>
  onNewDocument: () => Promise<ApiError | null>
  onOpenClassroom: (opening: ClassroomOpening) => void
  onShowWork: () => void
  onShowClasses: () => void
  onShowGroups: () => void
  onOpenGroup: (id: string) => void
  /** Message à annoncer à l'arrivée (ex. connexion réussie). */
  announcement: string | null
}

/**
 * Tableau de bord élève : ce qui reste à rendre, son travail en cours, et
 * ses classes à portée de clic.
 *
 * Rejoindre une classe garde sa place ici : sans classe, un élève ne peut
 * rien faire. La liste complète, elle, vit sur Mes classes.
 */
export function StudentHome({
  user,
  client,
  repository,
  onOpenDocument,
  onNewDocument,
  onOpenClassroom,
  onShowWork,
  onShowClasses,
  onShowGroups,
  onOpenGroup,
  announcement,
}: StudentHomeProps) {
  const classrooms = useClassrooms(client)
  const groups = useGroups(client)
  // Un seul appel sert deux usages : nommer la provenance d'un document
  // de travail, et lister ce qui reste à rendre.
  const { assignments, rows, error: assignmentsError, reload } = useMyAssignments(client)
  const [actionError, setActionError] = useState<string | null>(null)

  const list = classrooms.classrooms
  const pending = rows === null ? null : pendingAssignments(rows)

  const createDocument = async () => {
    setActionError(null)
    const error = await onNewDocument()
    if (error) setActionError(error.message)
  }

  return (
    <PageShell
      eyebrow="Espace élève"
      title={`Bonjour ${user.firstName ?? user.name}`}
      leading={<Avatar person={user} size="lg" />}
      description="Ce qui reste à rendre, votre travail en cours, et vos classes."
      actions={
        <Button variant="primary" onClick={() => void createDocument()}>
          <span aria-hidden="true">+</span>
          Nouveau document
        </Button>
      }
    >
      <LiveAnnouncement message={announcement} />
      {actionError && (
        <Notice tone="error" className="mb-6">
          {actionError}
        </Notice>
      )}

      <section aria-label="Vos chiffres" className="grid gap-3 sm:grid-cols-3">
        <Stat
          value={list === null ? '…' : String(list.length)}
          label={plural(list?.length ?? 0, 'classe', 'classes')}
        />
        <Stat
          value={groups.groups === null ? '…' : String(groups.groups.length)}
          label={plural(groups.groups?.length ?? 0, 'groupe', 'groupes')}
        />
        <Stat
          value={pending === null ? '…' : String(pending.length)}
          label={plural(pending?.length ?? 0, 'devoir à rendre', 'devoirs à rendre')}
        />
      </section>

      {/*
       * Deux colonnes : ce qu'on lit à gauche, ce sur quoi on agit à
       * droite. Sous le point de bascule, tout s'empile dans cet ordre.
       */}
      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="flex flex-col gap-8 lg:col-span-2">
          <AttentionToDo
            rows={rows}
            error={assignmentsError}
            onReload={reload}
            onOpenClassroom={onOpenClassroom}
          />

          <RecentDocuments
            repository={repository}
            onOpenDocument={onOpenDocument}
            onNewDocument={onNewDocument}
            onShowAll={onShowWork}
            assignments={assignments}
          />

          <ClassShortcuts
            title="Dans vos classes"
            classrooms={list ?? []}
            shortcuts={STUDENT_SHORTCUTS}
            onOpen={onOpenClassroom}
          />
        </div>

        <aside aria-label="Actions et accès rapide" className="flex flex-col gap-4">
          <Card as="section" aria-labelledby="rejoindre-titre">
            <h2 id="rejoindre-titre" className="text-base font-semibold text-ink">
              Rejoindre une classe
            </h2>
            <div className="mt-3">
              <JoinClassForm
                client={client}
                onJoined={(classroom) =>
                  onOpenClassroom({
                    id: classroom.id,
                    initial: classroom,
                    message: `Vous avez rejoint la classe « ${classroom.name} ».`,
                  })
                }
              />
            </div>
          </Card>

          <QuickAccess
            classrooms={list}
            groups={groups.groups}
            onOpenClassroom={(id) => onOpenClassroom({ id, initial: null, message: null })}
            onOpenGroup={onOpenGroup}
            onShowClasses={onShowClasses}
            onShowGroups={onShowGroups}
            emptyClassesText="Aucune classe pour l’instant. Saisissez le code donné par votre prof."
          />
        </aside>
      </div>
    </PageShell>
  )
}
