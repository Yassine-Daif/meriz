import { useId, useState } from 'react'
import type { ApiClient } from '../../lib/apiClient'
import { assignmentTypeLabel, formatDueDate } from '../../lib/assignmentsApi'
import type { Assignment } from '../../lib/assignmentsApi'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { TabPanel, Tabs } from '../ui/Tabs'
import { AssignmentEditor } from './AssignmentEditor'
import { SubmissionsPanel } from './SubmissionsPanel'
import type { EditAssignmentModel, OpenReadOnlyModel } from './types'

/** Sections d'un devoir ouvert, un cran sous les onglets de la classe. */
export type AssignmentTab = 'enonce' | 'rendus'

interface AssignmentWorkspaceProps {
  client: ApiClient
  classroomId: string
  classroomName: string
  /** Devoir ouvert, ou null pour une création. */
  assignment: Assignment | null
  /** Onglet affiché à l'arrivée (retour de l'outil MCD). */
  initialTab: AssignmentTab
  /** Rendu à rouvrir dans l'onglet Rendus. */
  openSubmissionId: string | null
  /** Retour à la liste des devoirs, avec un message à annoncer. */
  onDone: (message: string | null) => void
  onSaved: (assignment: Assignment) => void
  onEditModel: EditAssignmentModel
  onOpenReadOnlyModel: OpenReadOnlyModel
}

const TABS = [
  { value: 'enonce', label: 'Énoncé' },
  { value: 'rendus', label: 'Rendus' },
] as const

/**
 * Le cadre d'un devoir, côté prof : son entête, puis deux sections,
 * l'énoncé et les rendus. Une création n'a pas encore de rendus, donc
 * pas d'onglets : seul le formulaire s'affiche.
 */
export function AssignmentWorkspace({
  client,
  classroomId,
  classroomName,
  assignment,
  initialTab,
  openSubmissionId,
  onDone,
  onSaved,
  onEditModel,
  onOpenReadOnlyModel,
}: AssignmentWorkspaceProps) {
  const [tab, setTab] = useState<AssignmentTab>(initialTab)
  const idBase = useId()

  const editor = (
    <AssignmentEditor
      client={client}
      classroomId={classroomId}
      assignment={assignment}
      onDone={onDone}
      onSaved={onSaved}
      onEditModel={onEditModel}
    />
  )

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => onDone(null)} className="-ml-3 mb-3">
        <span aria-hidden="true">←</span>
        Retour aux devoirs
      </Button>

      {/* Surtitre : on est dans un devoir, sous l'onglet Exercices de la classe. */}
      {assignment && <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Devoir</p>}
      <h3 className="text-xl font-semibold tracking-tight text-ink">
        {assignment ? assignment.title : 'Créer un devoir'}
      </h3>
      <p className="mt-1 text-sm text-ink-soft">Classe {classroomName}.</p>

      {assignment && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone={assignment.status === 'published' ? 'sage' : 'neutral'}>
            {assignment.status === 'published' ? 'Publié' : 'Brouillon'}
          </Badge>
          <Badge tone="sky">{assignmentTypeLabel(assignment.type)}</Badge>
          <Badge tone={assignment.hasBase ? 'accent' : 'neutral'}>
            {assignment.hasBase ? 'Base prête' : 'Sans base'}
          </Badge>
          <Badge tone={assignment.hasSolution ? (assignment.solutionReleased ? 'apricot' : 'neutral') : 'neutral'}>
            {assignment.hasSolution
              ? assignment.solutionReleased
                ? 'Corrigé libéré'
                : 'Corrigé retenu'
              : 'Sans corrigé'}
          </Badge>
          <span className="text-sm text-ink-soft">{formatDueDate(assignment.dueAt)}</span>
        </div>
      )}

      {assignment ? (
        <div className="mt-5">
          <Tabs<AssignmentTab>
            label="Sections du devoir"
            items={TABS}
            value={tab}
            onChange={setTab}
            idBase={idBase}
            size="sm"
          />

          {tab === 'enonce' && (
            <TabPanel idBase={idBase} value="enonce">
              {editor}
            </TabPanel>
          )}

          {tab === 'rendus' && (
            <TabPanel idBase={idBase} value="rendus">
              <SubmissionsPanel
                client={client}
                assignment={assignment}
                openSubmissionId={openSubmissionId}
                onOpenReadOnlyModel={onOpenReadOnlyModel}
              />
            </TabPanel>
          )}
        </div>
      ) : (
        <div className="mt-5">{editor}</div>
      )}
    </div>
  )
}
