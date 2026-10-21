import { t } from "../i18n/runtime"
import { useLanguage } from "../lib/useLanguage"
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { ApiClient, ApiError } from '../lib/apiClient'
import { displayName } from '../lib/authApi'
import { formatDay } from '../lib/formatDate'
import {
  deleteClassroom,
  formatJoinCode,
  getClassroom,
  leaveClassroom,
  regenerateJoinCode,
  removeMember,
  renameClassroom,
} from '../lib/classroomsApi'
import type { ClassroomDetail, ClassroomMember } from '../lib/classroomsApi'
import { copyText } from '../lib/clipboard'
import { ConfirmDialog } from './ConfirmDialog'
import { Button } from './ui/Button'
import { ClassroomManagePanel } from './ClassroomManagePanel'
import { MemberCard } from './MemberCard'
import { PersonCard } from './PersonCard'
import { AssignmentsPanel } from './assignments/AssignmentsPanel'
import type { AssignmentTab } from './assignments/AssignmentWorkspace'
import { StudentAssignmentsPanel } from './assignments/StudentAssignmentsPanel'
import type {
  EditAssignmentModel,
  OpenLiveCoedition,
  OpenReadOnlyModel,
  OpenWorkDocument,
} from './assignments/types'
import { LessonsPanel } from './lessons/LessonsPanel'
import { StudentLessonsPanel } from './lessons/StudentLessonsPanel'
import { TabPanel, Tabs } from './ui/Tabs'
import { FormField } from './FormField'

interface ClassroomViewProps {
  client: ApiClient
  classroomId: string
  /** Devoir à rouvrir dans l'onglet Exercices (retour de l'outil MCD). */
  openAssignmentId?: string | null
  /** Rendu à rouvrir dans ce devoir (retour d'une consultation). */
  openSubmissionId?: string | null
  /** Section du devoir rouvert, quand ce n'est pas l'énoncé. */
  openAssignmentTab?: AssignmentTab | null
  /** Onglet d'arrivée, quand on vient d'un raccourci de l'accueil. */
  openTab?: ClassroomTab | null
  /** Ouvre l'outil MCD sur la base ou le corrigé d'un devoir. */
  onEditAssignmentModel: EditAssignmentModel
  /** Ouvre l'outil MCD sur le travail d'un élève pour un devoir. */
  onOpenWorkDocument: OpenWorkDocument
  /** Ouvre l'outil MCD en consultation (rendu d'un élève, corrigé libéré). */
  onOpenReadOnlyModel: OpenReadOnlyModel
  /** Corriger en direct le travail d'un élève, en co-édition. */
  onStartLiveCoedition: OpenLiveCoedition
  /** Vue déjà connue (création, adhésion) : affichée sans attendre. */
  initial: ClassroomDetail | null
  /** La classe n'est plus accessible (quittée, supprimée) : retour à la liste. */
  onGone: (message: string) => void
  /** Message à annoncer à l'arrivée (classe rejointe ou créée). */
  initialStatus?: string | null
}

/** Sections de l'espace d'une classe. */
export type ClassroomTab = 'eleves' | 'exercices' | 'cours' | 'reglages'

type PendingAction =
  | { kind: 'leave' }
  | { kind: 'delete' }
  | { kind: 'regenerate' }
  | { kind: 'remove'; member: ClassroomMember }


/**
 * Une classe. Pour tous : nom, prof et camarades, sans email. Pour le
 * prof de la classe : code à partager, dates d'arrivée, et la gestion
 * (renommer, nouveau code, retirer, supprimer), chaque action
 * destructive étant confirmée.
 */
export function ClassroomView({
  client,
  classroomId,
  initial,
  onGone,
  initialStatus = null,
  openAssignmentId = null,
  openSubmissionId = null,
  openAssignmentTab = null,
  openTab = null,
  onEditAssignmentModel,
  onOpenWorkDocument,
  onOpenReadOnlyModel,
  onStartLiveCoedition,
}: ClassroomViewProps) {
  useLanguage()
  const [classroom, setClassroom] = useState<ClassroomDetail | null>(initial)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [status, setStatus] = useState<{ kind: 'info' | 'error'; text: string } | null>(null)

  // Posé après le montage : une zone live n'annonce que ce qui change.
  useEffect(() => {
    if (initialStatus) setStatus({ kind: 'info', text: initialStatus })
  }, [initialStatus])
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [busy, setBusy] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState('')
  const [renameError, setRenameError] = useState<string | undefined>()
  // Onglet d'arrivée : celui demandé par un raccourci de l'accueil, sinon
  // Exercices au retour de l'outil MCD sur un devoir, sinon les élèves.
  const [tab, setTab] = useState<ClassroomTab>(openTab ?? (openAssignmentId ? 'exercices' : 'eleves'))
  const idBase = useId()

  // Le rappel du parent peut changer à chaque rendu : on garde le dernier
  // sans relancer le chargement.
  const onGoneRef = useRef(onGone)
  useEffect(() => {
    onGoneRef.current = onGone
  }, [onGone])

  const load = useCallback(async () => {
    setLoadError(null)
    const result = await getClassroom(client, classroomId)
    if (result.ok) {
      setClassroom(result.value)
    } else if (result.error.kind === 'not_found') {
      onGoneRef.current(t("Cette classe n'est plus accessible."))
    } else {
      setLoadError(result.error.message)
    }
  }, [client, classroomId])

  useEffect(() => {
    void load()
  }, [load])

  const report = (error: ApiError | null, success: string) => {
    setStatus(error ? { kind: 'error', text: error.message } : { kind: 'info', text: success })
  }

  const copyCode = async (code: string) => {
    const copied = await copyText(formatJoinCode(code))
    setStatus(
      copied
        ? { kind: 'info', text: t("Code {0} copié dans le presse-papiers.", [formatJoinCode(code)]) }
        : { kind: 'error', text: t("Copie impossible dans ce navigateur : recopiez le code affiché.") },
    )
  }

  const confirm = async () => {
    const action = pendingAction
    setPendingAction(null)
    if (!action || !classroom || busy) return
    setBusy(true)
    if (action.kind === 'leave') {
      const result = await leaveClassroom(client, classroom.id)
      setBusy(false)
      if (result.ok) onGone(t("Vous avez quitté la classe « {0} ».", [classroom.name]))
      else report(result.error, '')
    } else if (action.kind === 'delete') {
      const result = await deleteClassroom(client, classroom.id)
      setBusy(false)
      if (result.ok) onGone(t("Classe « {0} » supprimée.", [classroom.name]))
      else report(result.error, '')
    } else if (action.kind === 'regenerate') {
      const result = await regenerateJoinCode(client, classroom.id)
      setBusy(false)
      if (result.ok) setClassroom(result.value)
      report(
        result.ok ? null : result.error,
        t("Nouveau code : {0}. L'ancien ne fonctionne plus.", [formatJoinCode(result.ok ? (result.value.joinCode ?? '') : '')]),
      )
    } else {
      const result = await removeMember(client, classroom.id, action.member.id)
      setBusy(false)
      if (result.ok) {
        setClassroom({
          ...classroom,
          members: classroom.members.filter((member) => member.id !== action.member.id),
          membersCount: classroom.membersCount === null ? null : classroom.membersCount - 1,
        })
      }
      report(result.ok ? null : result.error, t("{0} a été retiré de la classe.", [displayName(action.member)]))
    }
  }

  const startRenaming = () => {
    setNewName(classroom?.name ?? '')
    setRenameError(undefined)
    setRenaming(true)
  }

  const submitRename = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!classroom || busy) return
    setBusy(true)
    setRenameError(undefined)
    const result = await renameClassroom(client, classroom.id, newName.trim())
    setBusy(false)
    if (result.ok) {
      setClassroom(result.value)
      setRenaming(false)
      setStatus({ kind: 'info', text: t("Classe renommée en « {0} ».", [result.value.name]) })
    } else {
      setRenameError(result.error.fieldErrors.name?.[0] ?? result.error.message)
    }
  }

  if (!classroom) {
    return (
      <div className="rounded-card border border-line bg-surface p-6 text-sm text-ink shadow-soft">
        {loadError ? (
          <p className="flex flex-wrap items-center gap-2">
            <span aria-hidden="true" className="text-warning">⚠</span>
            {loadError}
            <Button size="sm" onClick={() => void load()}>
              {t("Réessayer")}</Button>
          </p>
        ) : (
          <p role="status" className="text-ink-soft">{t("Chargement de la classe…")}</p>
        )}
      </div>
    )
  }

  const isTeacher = classroom.myRole === 'teacher'
  const dialogText: Record<PendingAction['kind'], { title: string; message: string; confirm: string }> = {
    leave: {
      title: t("Quitter la classe"),
      message: t("Quitter « {0} » ? Pour revenir, il vous faudra de nouveau son code.", [classroom.name]),
      confirm: t("Quitter la classe"),
    },
    delete: {
      title: t("Supprimer la classe"),
      message: t("Supprimer « {0} » ? Tous les membres en seront retirés. Cette action est définitive.", [classroom.name]),
      confirm: t("Supprimer la classe"),
    },
    regenerate: {
      title: t("Nouveau code"),
      message: t("Créer un nouveau code ? L'ancien code ne fonctionnera plus. Les membres actuels restent dans la classe."),
      confirm: t("Créer un nouveau code"),
    },
    remove: {
      title: t("Retirer un membre"),
      message:
        pendingAction?.kind === 'remove'
          ? t("Retirer {0} de la classe ? La personne pourra revenir avec le code.", [displayName(pendingAction.member)])
          : '',
      confirm: t("Retirer"),
    },
  }

  /*
   * Un onglet de réglages reçu par un élève retombe sur les membres :
   * l'onglet n'existe pas pour lui, et un panneau vide ne vaut rien.
   */
  const shown: ClassroomTab = tab === 'reglages' && !isTeacher ? 'eleves' : tab

  const tabs = [
    { value: 'eleves' as const, label: isTeacher ? t("Membres") : t("Élèves"), count: classroom.members.length },
    { value: 'exercices' as const, label: t("Exercices") },
    { value: 'cours' as const, label: t("Cours") },
    // La gestion n'a de sens que pour le prof : l'onglet n'existe pas
    // pour les autres, plutôt que de mener à un panneau vide.
    ...(isTeacher ? [{ value: 'reglages' as const, label: t("Réglages") }] : []),
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {renaming ? (
          <form onSubmit={(event) => void submitRename(event)} className="flex min-w-0 flex-1 flex-wrap items-end gap-2">
            <div className="min-w-60 flex-1">
              <FormField
                label={t("Nom de la classe")}
                type="text"
                value={newName}
                onChange={setNewName}
                autoComplete="off"
                maxLength={100}
                error={renameError}
              />
            </div>
            <Button type="submit" variant="primary" loading={busy} loadingLabel={t("Enregistrement…")}>
              {t("Renommer")}</Button>
            <Button type="button" onClick={() => setRenaming(false)}>
              {t("Annuler")}</Button>
          </form>
        ) : (
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold tracking-tight text-ink">{classroom.name}</h2>
            <p className="text-sm text-ink-soft">
              {isTeacher ? t("Vous êtes le prof de cette classe.") : t("Vous êtes élève dans cette classe.")}
            </p>
          </div>
        )}
        {isTeacher && !renaming && (
          <Button size="sm" onClick={startRenaming}>
            {t("Renommer")}</Button>
        )}
      </div>

      <p role="status" aria-live="polite" className="min-h-5 text-sm">
        {status && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-ink ${
              status.kind === 'error' ? 'bg-warning-soft' : 'bg-sage-soft'
            }`}
          >
            <span aria-hidden="true" className={status.kind === 'error' ? 'text-warning' : 'text-sage'}>
              {status.kind === 'error' ? '⚠' : '✓'}
            </span>
            {status.text}
          </span>
        )}
      </p>

      <div>
        <Tabs label={t("Sections de la classe")} items={tabs} value={shown} onChange={setTab} idBase={idBase} />

        {shown === 'eleves' && (
          <TabPanel idBase={idBase} value="eleves">
            <section aria-labelledby="prof-titre" className="rounded-card border border-line bg-surface p-5 shadow-soft">
              <h3 id="prof-titre" className="text-base font-semibold text-ink">
                {t("Prof")}</h3>
              <div className="mt-3">
                {classroom.teacher ? (
                  <PersonCard person={classroom.teacher} />
                ) : (
                  <p className="text-sm text-ink-soft">{t("Inconnu")}</p>
                )}
              </div>
            </section>

            <section aria-labelledby="membres-titre" className="mt-4">
              <h3 id="membres-titre" className="text-base font-semibold text-ink">
                {isTeacher ? t("Membres") : t("Camarades")} ({classroom.members.length})
              </h3>
              {classroom.members.length === 0 ? (
                <p className="mt-3 rounded-card border border-dashed border-line-strong bg-surface-soft p-6 text-center text-sm text-ink-soft">
                  {isTeacher
                    ? t("Personne pour l’instant : partagez le code ci-dessus à vos élèves.")
                    : t("Aucun autre membre pour l’instant.")}
                </p>
              ) : (
                <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {classroom.members.map((member) => (
              <MemberCard
                key={member.id}
                person={member}
                joined={isTeacher ? formatDay(member.joinedAt) : null}
                action={
                  isTeacher ? (
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={busy}
                      aria-label={t("Retirer {0} de la classe", [displayName(member)])}
                      onClick={() => setPendingAction({ kind: 'remove', member })}
                    >
                      {t("Retirer")}</Button>
                  ) : undefined
                }
              />
            ))}
          </ul>
              )}
            </section>

            {!isTeacher && (
              <div className="mt-6 border-t border-line pt-4">
                <Button
                  variant="danger"
                  size="sm"
                  disabled={busy}
                  onClick={() => setPendingAction({ kind: 'leave' })}
                >
                  {t("Quitter la classe")}</Button>
              </div>
            )}
          </TabPanel>
        )}

        {shown === 'exercices' && (
          <TabPanel idBase={idBase} value="exercices">
            {isTeacher ? (
              <AssignmentsPanel
                client={client}
                classroomId={classroom.id}
                classroomName={classroom.name}
                openAssignmentId={openAssignmentId}
                openSubmissionId={openSubmissionId}
                openAssignmentTab={openAssignmentTab}
                onEditAssignmentModel={onEditAssignmentModel}
                onOpenReadOnlyModel={onOpenReadOnlyModel}
                onStartLiveCoedition={onStartLiveCoedition}
              />
            ) : (
              <StudentAssignmentsPanel
                client={client}
                classroomId={classroom.id}
                openAssignmentId={openAssignmentId}
                onOpenWorkDocument={onOpenWorkDocument}
                onOpenReadOnlyModel={onOpenReadOnlyModel}
              />
            )}
          </TabPanel>
        )}

        {shown === 'reglages' && isTeacher && (
          <TabPanel idBase={idBase} value="reglages">
            <ClassroomManagePanel
              classroom={classroom}
              busy={busy}
              onCopyCode={() => void copyCode(classroom.joinCode ?? '')}
              onRegenerate={() => setPendingAction({ kind: 'regenerate' })}
              onRename={startRenaming}
              onDelete={() => setPendingAction({ kind: 'delete' })}
            />
          </TabPanel>
        )}

        {shown === 'cours' && (
          <TabPanel idBase={idBase} value="cours">
            {isTeacher ? (
              <LessonsPanel client={client} classroomId={classroom.id} classroomName={classroom.name} />
            ) : (
              <StudentLessonsPanel client={client} classroomId={classroom.id} />
            )}
          </TabPanel>
        )}
      </div>
      <ConfirmDialog
        open={pendingAction !== null}
        title={pendingAction ? dialogText[pendingAction.kind].title : ''}
        message={pendingAction ? dialogText[pendingAction.kind].message : ''}
        confirmLabel={pendingAction ? dialogText[pendingAction.kind].confirm : ''}
        onConfirm={() => void confirm()}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  )
}
