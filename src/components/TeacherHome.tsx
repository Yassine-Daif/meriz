import { useState } from 'react'
import type { ApiClient, ApiError } from '../lib/apiClient'
import type { ApiUser } from '../lib/authApi'
import { formatJoinCode } from '../lib/classroomsApi'
import type { DocumentRepository } from '../lib/documentRepository'
import { useClassrooms } from '../lib/useClassrooms'
import type { ClassroomOpening } from './ClassesPage'
import { ClassroomGrid } from './ClassroomGrid'
import { ClassShortcuts } from './ClassShortcuts'
import type { ClassShortcut } from './ClassShortcuts'
import { CreateClassForm } from './CreateClassForm'
import { PageShell } from './PageShell'
import { RecentDocuments } from './RecentDocuments'
import { Avatar } from './ui/Avatar'
import { Button } from './ui/Button'
import { LiveAnnouncement } from './ui/LiveAnnouncement'
import { Notice } from './ui/Notice'

/** Là où un prof va le plus souvent, dans une de ses classes. */
const TEACHER_SHORTCUTS: readonly ClassShortcut[] = [
  {
    tab: 'exercices',
    label: 'Devoirs',
    description: 'Les sujets donnés à la classe, leurs rendus, et la création d’un nouveau devoir.',
  },
  {
    tab: 'cours',
    label: 'Cours',
    description: 'Vos supports publiés pour la classe, et la composition d’un nouveau cours.',
  },
]

interface TeacherHomeProps {
  user: ApiUser
  client: ApiClient
  repository: DocumentRepository
  onOpenDocument: (id: string) => Promise<ApiError | null>
  onNewDocument: () => Promise<ApiError | null>
  onOpenClassroom: (opening: ClassroomOpening) => void
  onShowWork: () => void
  /** Les rendus à noter, toutes classes confondues. */
  onShowCorrections: () => void
  /** Message à annoncer à l'arrivée (ex. connexion réussie). */
  announcement: string | null
}

/** Un chiffre du bandeau : le nombre, puis ce qu'il compte, en toutes lettres. */
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-card border border-line bg-surface p-5 shadow-soft">
      <p className="text-3xl font-semibold tracking-tight text-ink">{value}</p>
      <p className="mt-0.5 text-sm text-ink-soft">{label}</p>
    </div>
  )
}

function plural(count: number, one: string, many: string): string {
  return count > 1 ? many : one
}

/**
 * Tableau de bord prof : ses classes et leurs codes en premier, la
 * création d'une classe à portée de main, ses documents, puis ce qui
 * arrive (devoirs, cours, corrections).
 */
export function TeacherHome({
  user,
  client,
  repository,
  onOpenDocument,
  onNewDocument,
  onOpenClassroom,
  onShowWork,
  onShowCorrections,
  announcement,
}: TeacherHomeProps) {
  const classrooms = useClassrooms(client)
  const [actionError, setActionError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [documentCount, setDocumentCount] = useState<number | null>(null)

  const list = classrooms.classrooms
  const mine = list?.filter((classroom) => classroom.myRole === 'teacher') ?? []
  // Effectifs renvoyés par le serveur pour mes classes ; une classe sans
  // effectif connu ne compte pas.
  const studentCount = mine.reduce((total, classroom) => total + (classroom.membersCount ?? 0), 0)
  const hasClassrooms = (list?.length ?? 0) > 0

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

  const createSection = (
    <section
      aria-labelledby="creer-titre"
      className="grid gap-6 rounded-panel bg-accent-soft p-6 sm:p-8 md:grid-cols-2 md:items-center"
    >
      <div>
        <h2 id="creer-titre" className="text-2xl font-semibold tracking-tight text-ink">
          Créer une classe
        </h2>
        <p className="mt-2 text-base leading-7 text-ink">
          Donnez-lui un nom : Meriz lui attribue un code de 8 caractères. Vos élèves le saisissent pour vous rejoindre.
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
  )

  const classesSection = (
    <section aria-labelledby="classes-titre">
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
          emptyText="Aucune classe pour l’instant : créez la première avec le formulaire ci-dessus."
        />
      </div>
    </section>
  )

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

      <section aria-label="Vos chiffres" className="grid gap-3 sm:grid-cols-3">
        <Stat
          value={list === null ? '…' : String(mine.length)}
          label={plural(mine.length, 'classe dont vous êtes le prof', 'classes dont vous êtes le prof')}
        />
        <Stat
          value={list === null ? '…' : String(studentCount)}
          label={plural(studentCount, 'élève inscrit', 'élèves inscrits')}
        />
        <Stat
          value={documentCount === null ? '…' : String(documentCount)}
          label={plural(documentCount ?? 0, 'document personnel', 'documents personnels')}
        />
      </section>

      {/* Les classes passent devant dès qu'il y en a ; sinon la création ouvre la marche. */}
      <div className="mt-10">{hasClassrooms ? classesSection : createSection}</div>
      {/* Les raccourcis suivent les classes : sans classe, ils ne s'affichent pas. */}
      {mine.length > 0 && (
        <div className="mt-10">
          <ClassShortcuts
            title="Pour vos classes"
            classrooms={mine}
            shortcuts={TEACHER_SHORTCUTS}
            action={
              <Button onClick={onShowCorrections}>Voir les rendus à corriger</Button>
            }
            onOpen={onOpenClassroom}
          />
        </div>
      )}
      <div className="mt-10">{hasClassrooms ? createSection : classesSection}</div>
      <div className="mt-10">
        <RecentDocuments
          repository={repository}
          onOpenDocument={onOpenDocument}
          onNewDocument={onNewDocument}
          onShowAll={onShowWork}
          onLoaded={(documents) => setDocumentCount(documents.length)}
        />
      </div>

    </PageShell>
  )
}
