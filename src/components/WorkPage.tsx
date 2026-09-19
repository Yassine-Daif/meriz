import { useState } from 'react'
import type { ApiError } from '../lib/apiClient'
import type { DocumentRepository } from '../lib/documentRepository'
import { DocumentList } from './DocumentList'
import { PageShell } from './PageShell'
import { ComingSoon } from './ui/ComingSoon'
import { Segmented } from './ui/Segmented'

type WorkTab = 'personal' | 'class'

const TABS = [
  { value: 'personal', label: 'Personnel' },
  { value: 'class', label: 'Travail de classe' },
] as const

interface WorkPageProps {
  repository: DocumentRepository
  onOpenDocument: (id: string) => Promise<ApiError | null>
  onNewDocument: () => Promise<ApiError | null>
  onOpenExample: () => Promise<ApiError | null>
  onImportFile: (file: File) => Promise<string | null>
}

/**
 * Mon travail : mes documents personnels, avec toutes leurs actions. Le
 * travail rendu dans une classe aura son onglet avec la phase suivante.
 */
export function WorkPage({ repository, onOpenDocument, onNewDocument, onOpenExample, onImportFile }: WorkPageProps) {
  const [tab, setTab] = useState<WorkTab>('personal')

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
            provenance={{ label: 'Perso', tone: 'apricot' }}
            onOpenDocument={onOpenDocument}
            onNewDocument={onNewDocument}
            onOpenExample={onOpenExample}
            onImportFile={onImportFile}
          />
        ) : (
          <ComingSoon
            headingLevel="h2"
            title="Travail de classe"
            description="Les exercices et examens de vos classes, avec leur provenance, se retrouveront ici."
          />
        )}
      </div>
    </PageShell>
  )
}
