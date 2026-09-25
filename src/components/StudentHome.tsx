import { useState } from 'react'
import type { ApiClient, ApiError } from '../lib/apiClient'
import type { ApiUser } from '../lib/authApi'
import type { DocumentRepository } from '../lib/documentRepository'
import { useClassrooms } from '../lib/useClassrooms'
import type { ClassroomOpening } from './ClassesPage'
import { ClassroomGrid } from './ClassroomGrid'
import { ClassShortcuts } from './ClassShortcuts'
import type { ClassShortcut } from './ClassShortcuts'
import { JoinClassForm } from './JoinClassForm'
import { PageShell } from './PageShell'
import { RecentDocuments } from './RecentDocuments'
import { Avatar } from './ui/Avatar'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { LiveAnnouncement } from './ui/LiveAnnouncement'
import { Notice } from './ui/Notice'

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
  /** Message à annoncer à l'arrivée (ex. connexion réussie). */
  announcement: string | null
}

/**
 * Tableau de bord élève : reprendre son travail, retrouver ses classes,
 * en rejoindre une. Exercices, examens et cours arrivent plus tard.
 */
export function StudentHome({
  user,
  client,
  repository,
  onOpenDocument,
  onNewDocument,
  onOpenClassroom,
  onShowWork,
  announcement,
}: StudentHomeProps) {
  const classrooms = useClassrooms(client)
  const [actionError, setActionError] = useState<string | null>(null)

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
      description="Reprenez votre travail là où vous l'avez laissé, ou retrouvez vos classes."
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

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="flex flex-col gap-8 lg:col-span-2">
          <RecentDocuments
            repository={repository}
            onOpenDocument={onOpenDocument}
            onNewDocument={onNewDocument}
            onShowAll={onShowWork}
          />

          <section aria-labelledby="classes-titre">
            <h2 id="classes-titre" className="text-lg font-semibold tracking-tight text-ink">
              Mes classes
            </h2>
            <div className="mt-3">
              <ClassroomGrid
                state={classrooms}
                onOpen={(classroom) => onOpenClassroom({ id: classroom.id, initial: null, message: null })}
                emptyText="Aucune classe pour l’instant : saisissez le code donné par votre prof."
              />
            </div>
          </section>
        </div>

        <aside aria-label="Rejoindre une classe" className="flex flex-col gap-4">
          <Card>
            <h2 className="text-base font-semibold text-ink">Rejoindre une classe</h2>
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
        </aside>
      </div>

      <div className="mt-10">
        <ClassShortcuts
          title="Dans vos classes"
          classrooms={classrooms.classrooms ?? []}
          shortcuts={STUDENT_SHORTCUTS}
          onOpen={onOpenClassroom}
        />
      </div>
    </PageShell>
  )
}
