import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { ApiClient, ApiError } from '../../lib/apiClient'
import { displayName } from '../../lib/authApi'
import { formatJoinCode } from '../../lib/classroomsApi'
import { copyText } from '../../lib/clipboard'
import {
  deleteGroup,
  getGroup,
  leaveGroup,
  regenerateGroupCode,
  removeGroupMember,
  renameGroup,
} from '../../lib/groupsApi'
import type { GroupDetail, GroupMember } from '../../lib/groupsApi'
import { ConfirmDialog } from '../ConfirmDialog'
import { FormField } from '../FormField'
import { PersonCard } from '../PersonCard'
import { smallButtonClass } from '../buttonStyles'
import { Button } from '../ui/Button'
import { TabPanel, Tabs } from '../ui/Tabs'
import { GroupDocumentsPanel } from './GroupDocumentsPanel'
import type { OpenGroupDocument } from './GroupDocumentsPanel'
import { GroupManagePanel } from './GroupManagePanel'
import { GroupMembersPanel } from './GroupMembersPanel'

export type GroupTab = 'membres' | 'documents'

type PendingAction =
  | { kind: 'leave' }
  | { kind: 'delete' }
  | { kind: 'regenerate' }
  | { kind: 'remove'; member: GroupMember }

interface GroupViewProps {
  client: ApiClient
  groupId: string
  /** Groupe déjà connu, affiché sans attendre le serveur. */
  initial: GroupDetail | null
  initialStatus?: string | null
  openTab?: GroupTab | null
  /** Le groupe n'existe plus pour moi : on remonte à la liste. */
  onGone: (message: string) => void
  onOpenGroupDocument: OpenGroupDocument
}

const TABS = [
  { value: 'membres', label: 'Membres' },
  { value: 'documents', label: 'Documents' },
] as const

/**
 * Un groupe. Pour tous : son nom, ses membres et ses documents
 * partagés. Pour son créateur : le code à partager, l'invitation, et la
 * gestion (renommer, nouveau code, retirer, supprimer), chaque action
 * destructive étant confirmée.
 */
export function GroupView({
  client,
  groupId,
  initial,
  initialStatus = null,
  openTab = null,
  onGone,
  onOpenGroupDocument,
}: GroupViewProps) {
  const [group, setGroup] = useState<GroupDetail | null>(initial)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [status, setStatus] = useState<{ kind: 'info' | 'error'; text: string } | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [busy, setBusy] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState('')
  const [renameError, setRenameError] = useState<string | undefined>()
  const [tab, setTab] = useState<GroupTab>(openTab ?? 'membres')
  const idBase = useId()

  // Posé après le montage : une zone live n'annonce que ce qui change.
  useEffect(() => {
    if (initialStatus) setStatus({ kind: 'info', text: initialStatus })
  }, [initialStatus])

  // Le rappel du parent peut changer à chaque rendu : on garde le dernier
  // sans relancer le chargement.
  const onGoneRef = useRef(onGone)
  useEffect(() => {
    onGoneRef.current = onGone
  }, [onGone])

  const load = useCallback(async () => {
    setLoadError(null)
    const result = await getGroup(client, groupId)
    if (result.ok) {
      setGroup(result.value)
    } else if (result.error.kind === 'not_found') {
      onGoneRef.current("Ce groupe n'est plus accessible.")
    } else {
      setLoadError(result.error.message)
    }
  }, [client, groupId])

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
        ? { kind: 'info', text: `Code ${formatJoinCode(code)} copié dans le presse-papiers.` }
        : { kind: 'error', text: 'Copie impossible dans ce navigateur : recopiez le code affiché.' },
    )
  }

  const confirm = async () => {
    const action = pendingAction
    setPendingAction(null)
    if (!action || !group || busy) return
    setBusy(true)
    if (action.kind === 'leave') {
      const result = await leaveGroup(client, group.id)
      setBusy(false)
      if (result.ok) onGone(`Vous avez quitté le groupe « ${group.name} ».`)
      else report(result.error, '')
    } else if (action.kind === 'delete') {
      const result = await deleteGroup(client, group.id)
      setBusy(false)
      if (result.ok) onGone(`Groupe « ${group.name} » supprimé.`)
      else report(result.error, '')
    } else if (action.kind === 'regenerate') {
      const result = await regenerateGroupCode(client, group.id)
      setBusy(false)
      if (result.ok) setGroup(result.value)
      report(
        result.ok ? null : result.error,
        `Nouveau code : ${formatJoinCode(result.ok ? (result.value.joinCode ?? '') : '')}. L'ancien ne fonctionne plus.`,
      )
    } else {
      const result = await removeGroupMember(client, group.id, action.member.id)
      setBusy(false)
      if (result.ok) {
        setGroup({
          ...group,
          members: group.members.filter((member) => member.id !== action.member.id),
          membersCount: group.membersCount === null ? null : group.membersCount - 1,
        })
      }
      report(result.ok ? null : result.error, `${displayName(action.member)} a été retiré du groupe.`)
    }
  }

  const startRenaming = () => {
    setNewName(group?.name ?? '')
    setRenameError(undefined)
    setRenaming(true)
  }

  const submitRename = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!group || busy) return
    setBusy(true)
    setRenameError(undefined)
    const result = await renameGroup(client, group.id, newName.trim())
    setBusy(false)
    if (result.ok) {
      setGroup(result.value)
      setRenaming(false)
      setStatus({ kind: 'info', text: `Groupe renommé en « ${result.value.name} ».` })
    } else {
      setRenameError(result.error.fieldErrors.name?.[0] ?? result.error.message)
    }
  }

  if (!group) {
    return (
      <div className="rounded-card border border-line bg-surface p-6 text-sm text-ink shadow-soft">
        {loadError ? (
          <p className="flex flex-wrap items-center gap-2">
            <span aria-hidden="true" className="text-warning">
              ⚠
            </span>
            {loadError}
            <button type="button" onClick={() => void load()} className={smallButtonClass}>
              Réessayer
            </button>
          </p>
        ) : (
          <p role="status" className="text-ink-soft">
            Chargement du groupe…
          </p>
        )}
      </div>
    )
  }

  const admin = group.myRole === 'admin'
  const dialogText: Record<PendingAction['kind'], { title: string; message: string; confirm: string }> = {
    leave: {
      title: 'Quitter le groupe',
      message: `Quitter « ${group.name} » ? Vous perdrez l'accès à ses documents partagés. Pour revenir, il vous faudra de nouveau son code.`,
      confirm: 'Quitter le groupe',
    },
    delete: {
      title: 'Supprimer le groupe',
      message: `Supprimer « ${group.name} » ? Ses documents partagés seront effacés pour tous. Cette action est définitive.`,
      confirm: 'Supprimer le groupe',
    },
    regenerate: {
      title: 'Nouveau code',
      message:
        "Créer un nouveau code ? L'ancien code ne fonctionnera plus. Les membres actuels restent dans le groupe.",
      confirm: 'Créer un nouveau code',
    },
    remove: {
      title: 'Retirer un membre',
      message:
        pendingAction?.kind === 'remove'
          ? `Retirer ${displayName(pendingAction.member)} du groupe ? La personne pourra revenir avec le code.`
          : '',
      confirm: 'Retirer du groupe',
    },
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {renaming ? (
            <form onSubmit={(event) => void submitRename(event)} className="flex flex-wrap items-end gap-2">
              <FormField
                label="Nouveau nom du groupe"
                type="text"
                value={newName}
                onChange={setNewName}
                autoComplete="off"
                maxLength={100}
                error={renameError}
              />
              <Button type="submit" variant="primary" size="sm" loading={busy} loadingLabel="Enregistrement…">
                Enregistrer
              </Button>
              <Button type="button" size="sm" onClick={() => setRenaming(false)}>
                Annuler
              </Button>
            </form>
          ) : (
            <>
              <h2 className="text-xl font-semibold tracking-tight text-ink">{group.name}</h2>
              <p className="mt-1 text-sm text-ink-soft">
                {admin ? 'Vous avez créé ce groupe.' : 'Vous êtes membre de ce groupe.'}
                {group.creator && !admin && ` Créé par ${displayName(group.creator)}.`}
              </p>
            </>
          )}
        </div>
        {admin && !renaming && (
          <Button size="sm" onClick={startRenaming} disabled={busy}>
            Renommer
          </Button>
        )}
      </div>

      <p role="status" aria-live="polite" className="mt-2 min-h-5 text-sm">
        {status && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${
              status.kind === 'error' ? 'bg-warning-soft text-ink' : 'bg-sage-soft text-ink'
            }`}
          >
            <span aria-hidden="true" className={status.kind === 'error' ? 'text-warning' : 'text-sage'}>
              {status.kind === 'error' ? '⚠' : '✓'}
            </span>
            {status.text}
          </span>
        )}
      </p>

      {admin && (
        <GroupManagePanel
          group={group}
          busy={busy}
          onCopyCode={() => void copyCode(group.joinCode ?? '')}
          onRegenerate={() => setPendingAction({ kind: 'regenerate' })}
          onRename={startRenaming}
          onDelete={() => setPendingAction({ kind: 'delete' })}
          onStatus={(text) => setStatus({ kind: 'info', text })}
        />
      )}

      {!admin && group.creator && (
        <div className="mt-4 rounded-card border border-line bg-surface p-4 shadow-soft">
          <PersonCard person={group.creator} extra="Créateur du groupe" />
        </div>
      )}

      <div className="mt-6">
        <Tabs label="Sections du groupe" items={[...TABS]} value={tab} onChange={setTab} idBase={idBase} />

        {tab === 'membres' && (
          <TabPanel idBase={idBase} value="membres">
            <GroupMembersPanel
              group={group}
              busy={busy}
              onRemove={(member) => setPendingAction({ kind: 'remove', member })}
              onLeave={() => setPendingAction({ kind: 'leave' })}
            />
          </TabPanel>
        )}

        {tab === 'documents' && (
          <TabPanel idBase={idBase} value="documents">
            <GroupDocumentsPanel
              client={client}
              group={group}
              onOpenGroupDocument={onOpenGroupDocument}
              onStatus={(text) => setStatus({ kind: 'info', text })}
            />
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
