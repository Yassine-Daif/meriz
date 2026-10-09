import { useState } from 'react'
import type { ApiClient, ApiError } from '../lib/apiClient'
import type { ApiUser } from '../lib/authApi'
import type { DocumentRepository } from '../lib/documentRepository'
import { plural } from '../lib/plural'
import { useClassrooms } from '../lib/useClassrooms'
import { useGroups } from '../lib/useGroups'
import { useToGrade } from '../lib/useToGrade'
import type { ClassroomOpening } from './ClassesPage'
import { ClassShortcuts } from './ClassShortcuts'
import type { ClassShortcut } from './ClassShortcuts'
import type { CorrectionOpening } from './CorrectionsPage'
import { AttentionToGrade } from './home/AttentionToGrade'
import { QuickAccess } from './home/QuickAccess'
import { PageShell } from './PageShell'
import { RecentDocuments } from './RecentDocuments'
import { Avatar } from './ui/Avatar'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { LiveAnnouncement } from './ui/LiveAnnouncement'
import { Notice } from './ui/Notice'
import { Stat } from './ui/Stat'

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
  /** Un rendu précis, ouvert depuis le tableau de bord. */
  onOpenCorrection: (opening: CorrectionOpening) => void
  onShowClasses: () => void
  onShowGroups: () => void
  onOpenGroup: (id: string) => void
  /** Message à annoncer à l'arrivée (ex. connexion réussie). */
  announcement: string | null
}

/**
 * Tableau de bord prof : les chiffres, ce qui demande une correction, ses
 * documents, et les actions à portée de clic.
 *
 * La liste complète des classes n'est pas ici : elle vit sur Mes classes,
 * avec les formulaires Créer et Rejoindre, et une recherche quand il y en
 * a beaucoup. L'accueil n'en garde qu'un accès rapide.
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
  onOpenCorrection,
  onShowClasses,
  onShowGroups,
  onOpenGroup,
  announcement,
}: TeacherHomeProps) {
  const classrooms = useClassrooms(client)
  const groups = useGroups(client)
  const toGrade = useToGrade(client)
  const [actionError, setActionError] = useState<string | null>(null)

  const list = classrooms.classrooms
  const mine = list?.filter((classroom) => classroom.myRole === 'teacher') ?? []
  // Effectifs renvoyés par le serveur pour mes classes ; une classe sans
  // effectif connu ne compte pas.
  const studentCount = mine.reduce((total, classroom) => total + (classroom.membersCount ?? 0), 0)

  const createDocument = async () => {
    setActionError(null)
    const error = await onNewDocument()
    if (error) setActionError(error.message)
  }

  return (
    <PageShell
      eyebrow="Espace prof"
      title={`Bonjour ${user.firstName ?? user.name}`}
      leading={<Avatar person={user} size="lg" />}
      description="Ce qui attend une correction, vos documents, et vos classes à portée de clic."
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
          value={toGrade.rows === null ? '…' : String(toGrade.total)}
          label={plural(toGrade.total, 'rendu à corriger', 'rendus à corriger')}
        />
      </section>

      {/*
       * Deux colonnes : ce qu'on lit à gauche, ce sur quoi on agit à
       * droite. Sous le point de bascule, tout s'empile dans cet ordre.
       */}
      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="flex flex-col gap-8 lg:col-span-2">
          <AttentionToGrade state={toGrade} onOpen={onOpenCorrection} onShowAll={onShowCorrections} />

          <RecentDocuments
            repository={repository}
            onOpenDocument={onOpenDocument}
            onNewDocument={onNewDocument}
            onShowAll={onShowWork}
          />

          {mine.length > 0 && (
            <ClassShortcuts
              title="Pour vos classes"
              classrooms={mine}
              shortcuts={TEACHER_SHORTCUTS}
              onOpen={onOpenClassroom}
            />
          )}
        </div>

        <aside aria-label="Actions et accès rapide" className="flex flex-col gap-4">
          <Card as="section" aria-labelledby="actions-titre">
            <h2 id="actions-titre" className="text-base font-semibold text-ink">
              Actions
            </h2>
            <div className="mt-3 flex flex-col gap-2">
              <Button variant="primary" block onClick={() => void createDocument()}>
                <span aria-hidden="true">+</span>
                Nouveau document
              </Button>
              <Button variant="secondary" block onClick={onShowClasses}>
                Créer une classe
              </Button>
              <Button variant="secondary" block onClick={onShowCorrections}>
                Voir les rendus à corriger
              </Button>
            </div>
          </Card>

          <QuickAccess
            classrooms={list}
            groups={groups.groups}
            onOpenClassroom={(id) => onOpenClassroom({ id, initial: null, message: null })}
            onOpenGroup={onOpenGroup}
            onShowClasses={onShowClasses}
            onShowGroups={onShowGroups}
            emptyClassesText="Aucune classe pour l’instant. Créez-en une et partagez son code à vos élèves."
          />
        </aside>
      </div>
    </PageShell>
  )
}
