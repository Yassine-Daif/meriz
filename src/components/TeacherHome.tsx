import { useState } from 'react'
import type { ApiClient, ApiError } from '../lib/apiClient'
import type { ApiUser } from '../lib/authApi'
import { formatJoinCode } from '../lib/classroomsApi'
import type { DocumentRepository } from '../lib/documentRepository'
import { useClassrooms } from '../lib/useClassrooms'
import type { ClassroomOpening } from './ClassesPage'
import { ClassroomGrid } from './ClassroomGrid'
import { CreateClassForm } from './CreateClassForm'
import { PageShell } from './PageShell'
import { RecentDocuments } from './RecentDocuments'
import { Avatar } from './ui/Avatar'
import { Button } from './ui/Button'
import { ComingSoon } from './ui/ComingSoon'
import { LiveAnnouncement } from './ui/LiveAnnouncement'
import { Notice } from './ui/Notice'

interface TeacherHomeProps {
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
 * Tableau de bord prof : créer une classe en premier, partager les codes,
 * reprendre ses documents. Devoirs, cours et corrections arrivent plus tard.
 */
export function TeacherHome({
  user,
  client,
  repository,
  onOpenDocument,
  onNewDocument,
  onOpenClassroom,
  onShowWork,
  announcement,
}: TeacherHomeProps) {
  const classrooms = useClassrooms(client)
  const [actionError, setActionError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const createDocument = async () => {
    setActionError(null)
    const error = await onNewDocument()
    if (error) setActionError(error.message)
  }

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(formatJoinCode(code))
      setStatus(`Code ${formatJoinCode(code)} copié dans le presse-papiers.`)
    } catch {
      setStatus('Copie impossible dans ce navigateur : recopiez le code affiché.')
    }
  }

  return (
    <PageShell
      eyebrow="Espace prof"
      title={`Bonjour ${user.firstName ?? user.name}`}
      leading={<Avatar person={user} size="lg" />}
      description="Vos classes, leurs codes à partager, et vos propres documents."
      actions={
        <Button variant="secondary" onClick={() => void createDocument()}>
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

      <section
        aria-labelledby="creer-titre"
        className="grid gap-6 rounded-panel bg-accent-soft p-6 sm:p-8 md:grid-cols-2 md:items-center"
      >
        <div>
          <h2 id="creer-titre" className="text-2xl font-semibold tracking-tight text-ink">
            Créer une classe
          </h2>
          <p className="mt-2 text-base leading-7 text-ink">
            Donnez-lui un nom : Meriz lui attribue un code de 8 caractères. Vos élèves le saisissent pour vous
            rejoindre.
          </p>
        </div>
        <div className="rounded-card bg-surface p-5 shadow-soft">
          <CreateClassForm
            client={client}
            onCreated={(classroom) =>
              onOpenClassroom({
                id: classroom.id,
                initial: classroom,
                message: `Classe « ${classroom.name} » créée. Partagez son code à vos élèves.`,
              })
            }
          />
        </div>
      </section>

      <section aria-labelledby="classes-titre" className="mt-10">
        <h2 id="classes-titre" className="text-lg font-semibold tracking-tight text-ink">
          Mes classes
        </h2>
        <p role="status" aria-live="polite" className="mt-1 min-h-5 text-sm text-ink-soft">
          {status}
        </p>
        <div className="mt-2">
          <ClassroomGrid
            state={classrooms}
            onOpen={(classroom) => onOpenClassroom({ id: classroom.id, initial: null, message: null })}
            onCopyCode={(code) => void copyCode(code)}
            emptyText="Aucune classe pour l’instant : créez la première ci-dessus."
          />
        </div>
      </section>

      <div className="mt-10">
        <RecentDocuments
          repository={repository}
          onOpenDocument={onOpenDocument}
          onNewDocument={onNewDocument}
          onShowAll={onShowWork}
        />
      </div>

      <section aria-labelledby="bientot-titre" className="mt-10">
        <h2 id="bientot-titre" className="text-lg font-semibold tracking-tight text-ink">
          Bientôt pour vos classes
        </h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <ComingSoon title="Créer un devoir" description="Confier un sujet de MCD à une classe, avec une échéance." />
          <ComingSoon title="Créer un cours" description="Publier vos supports, à côté de l'outil de modélisation." />
          <ComingSoon title="À corriger" description="Les rendus de vos élèves, regroupés et prêts à annoter." />
        </div>
      </section>
    </PageShell>
  )
}
