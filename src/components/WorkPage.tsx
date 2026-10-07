import { useState } from 'react'
import type { ApiClient, ApiError } from '../lib/apiClient'
import type { DocumentRepository } from '../lib/documentRepository'
import { useMyAssignments } from '../lib/useMyAssignments'
import { ClassWorkPanel } from './assignments/ClassWorkPanel'
import type { OpenReadOnlyModel, OpenWorkDocument } from './assignments/types'
import { DocumentList } from './DocumentList'
import { PageShell } from './PageShell'
import { Segmented } from './ui/Segmented'

type WorkTab = 'personal' | 'class'

const TABS = [
  { value: 'personal', label: 'Personnel' },
  { value: 'class', label: 'Travail de classe' },
] as const

interface WorkPageProps {
  client: ApiClient
  repository: DocumentRepository
  /** Élève : ses devoirs nomment la provenance de son travail. Un prof n'en a pas. */
  student: boolean
  /** Devoir à rouvrir d'emblée (retour de l'outil MCD). */
  openAssignmentId: string | null
  onOpenDocument: (id: string) => Promise<ApiError | null>
  onNewDocument: () => Promise<ApiError | null>
  onOpenExample: () => Promise<ApiError | null>
  onImportFile: (file: File) => Promise<string | null>
  onOpenWorkDocument: OpenWorkDocument
  onOpenReadOnlyModel: OpenReadOnlyModel
}

/**
 * Mon travail : mes documents personnels d'un côté, les devoirs de mes
 * classes de l'autre, toutes classes confondues.
 */
export function WorkPage({
  client,
  repository,
  student,
  openAssignmentId,
  onOpenDocument,
  onNewDocument,
  onOpenExample,
  onImportFile,
  onOpenWorkDocument,
  onOpenReadOnlyModel,
}: WorkPageProps) {
  // Revenir de l'outil sur un devoir ramène à l'onglet qui l'a ouvert.
  const [tab, setTab] = useState<WorkTab>(openAssignmentId === null ? 'personal' : 'class')
  const { assignments } = useMyAssignments(client, student)

  return (
    <PageShell
      title="Mon travail"
      description="Vos documents sont enregistrés dans votre compte et vous suivent partout."
    >
      <Segmented<WorkTab> legend="Afficher" hideLegend options={TABS} value={tab} onChange={setTab} />

      <div className="mt-6">
        {tab === 'personal' ? (
          <DocumentList
            repository={repository}
            cloud
            heading="Documents personnels"
            assignments={assignments}
            onOpenDocument={onOpenDocument}
            onNewDocument={onNewDocument}
            onOpenExample={onOpenExample}
            onImportFile={onImportFile}
          />
        ) : (
          <ClassWorkPanel
            client={client}
            openAssignmentId={openAssignmentId}
            onOpenWorkDocument={onOpenWorkDocument}
            onOpenReadOnlyModel={onOpenReadOnlyModel}
          />
        )}
      </div>
    </PageShell>
  )
}
