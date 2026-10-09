import { useId, useState } from 'react'
import type { ApiClient } from '../../lib/apiClient'
import { assignmentTypeLabel, formatDueDate } from '../../lib/assignmentsApi'
import type { Assignment } from '../../lib/assignmentsApi'
import { BackButton } from '../ui/BackButton'
import { Badge } from '../ui/Badge'
import { TabPanel, Tabs } from '../ui/Tabs'
import { AssignmentEditor } from './AssignmentEditor'
import { LiveTrackingPanel } from './LiveTrackingPanel'
import { SubmissionsPanel } from './SubmissionsPanel'
import type { EditAssignmentModel, OpenLiveCoedition, OpenReadOnlyModel } from './types'

/** Sections d'un devoir ouvert, un cran sous les onglets de la classe. */
export type AssignmentTab = 'enonce' | 'rendus' | 'suivi'

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
  /** Le devoir a changé sans que l'on change de section (suivi ouvert ou fermé). */
  onAssignmentChanged: (assignment: Assignment) => void
  onEditModel: EditAssignmentModel
  onOpenReadOnlyModel: OpenReadOnlyModel
  /** Corriger en direct le travail d'un élève, en co-édition. */
  onStartLiveCoedition: OpenLiveCoedition
}

const TABS = [
  { value: 'enonce', label: 'Énoncé' },
  { value: 'rendus', label: 'Rendus' },
  { value: 'suivi', label: 'Suivi' },
] as const

/**
 * Le cadre d'un devoir, côté prof : son entête, puis trois sections,
 * l'énoncé, les rendus et le suivi en direct. Une création n'a encore
 * ni rendus ni suivi, donc pas d'onglets : seul le formulaire s'affiche.
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
  onAssignmentChanged,
  onEditModel,
  onOpenReadOnlyModel,
  onStartLiveCoedition,
}: AssignmentWorkspaceProps) {
  const [tab, setTab] = useState<AssignmentTab>(initialTab)
  /*
   * Ouvrir l'onglet Suivi ouvre le suivi, mais une fermeture à la main
   * se respecte : le panneau se démonte en changeant d'onglet, donc la
   * mémoire vit ici. Quitter le devoir la remet à zéro, puisque ce cadre
   * est remonté par clé à chaque devoir.
   */
  const [trackingClosedByHand, setTrackingClosedByHand] = useState(false)
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
      <BackButton label="Retour aux devoirs" onClick={() => onDone(null)} className="-ml-3 mb-3" />

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

          {/* Quitter cet onglet démonte le panneau : le suivi s'arrête de lui-même. */}
          {tab === 'suivi' && (
            <TabPanel idBase={idBase} value="suivi">
              <LiveTrackingPanel
                client={client}
                assignment={assignment}
                onTrackingChanged={onAssignmentChanged}
                onOpenReadOnlyModel={onOpenReadOnlyModel}
                onStartLiveCoedition={onStartLiveCoedition}
                autoOpen={!trackingClosedByHand}
                onTrackingClosed={() => setTrackingClosedByHand(true)}
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
