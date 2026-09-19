import { useState } from 'react'
import type { ApiClient, ApiError } from '../lib/apiClient'
import type { ApiUser } from '../lib/authApi'
import type { DocumentRepository } from '../lib/documentRepository'
import { useClassrooms } from '../lib/useClassrooms'
import type { ClassroomOpening } from './ClassesPage'
import { ClassroomGrid } from './ClassroomGrid'
import { JoinClassForm } from './JoinClassForm'
import { PageShell } from './PageShell'
import { RecentDocuments } from './RecentDocuments'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { ComingSoon } from './ui/ComingSoon'
import { LiveAnnouncement } from './ui/LiveAnnouncement'
import { Notice } from './ui/Notice'

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

      <section aria-labelledby="bientot-titre" className="mt-10">
        <h2 id="bientot-titre" className="text-lg font-semibold tracking-tight text-ink">
          Bientôt dans vos classes
        </h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <ComingSoon title="Exercices" description="Les MCD à réaliser que votre prof vous confie, avec leur échéance." />
          <ComingSoon title="Examens" description="Des épreuves chronométrées, rendues directement depuis Meriz." />
          <ComingSoon title="Cours" description="Les supports de votre prof, à côté de l'outil pour pratiquer." />
        </div>
      </section>
    </PageShell>
  )
}
