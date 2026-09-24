import { useCallback, useEffect, useState } from 'react'
import type { DocumentMeta, OpenedDocument } from './model/document'
import { emptyEditorState } from './model/document'
import type { McdEditorState } from './model/mcdReducer'
import type { MpdSettings } from './model/mpd'
import { DEFAULT_MPD_SETTINGS } from './model/mpd'
import { EXAMPLE_NAME, exampleLayout, exampleMcd } from './model/example'
import type { ApiError } from './lib/apiClient'
import { apiError } from './lib/apiClient'
import { browserStorage } from './lib/browserStorage'
import { createInertSaver, createLocalRepository } from './lib/documentRepository'
import type { DocumentRepository, DocumentSaver } from './lib/documentRepository'
import { browserDocumentStore } from './lib/documentStore'
import { importModelFile } from './lib/importFile'
import { parseModelFile } from './lib/persistence'
import { createAssignmentSaver } from './lib/assignmentSaver'
import type { AssignmentField } from './lib/assignmentsApi'
import { markOffered, unofferedLocalIds } from './lib/importOffers'
import { DocumentsHome } from './components/DocumentsHome'
import { Editor } from './components/Editor'
import { AuthPage } from './components/AuthPage'
import type { AuthMode } from './components/AuthPage'
import { ImportLocalDialog } from './components/ImportLocalDialog'
import type { ImportReport } from './components/ImportLocalDialog'
import { AccountLoading } from './components/AccountLoading'
import { ProfilePage } from './components/ProfilePage'
import { ClassesPage } from './components/ClassesPage'
import type { ClassroomOpening } from './components/ClassesPage'
import type { ReadOnlyModel } from './components/assignments/types'
import { ConnectedShell } from './components/ConnectedShell'
import type { ConnectedPage } from './components/ConnectedShell'
import { StudentHome } from './components/StudentHome'
import { TeacherHome } from './components/TeacherHome'
import { WorkPage } from './components/WorkPage'
import { useSession } from './components/sessionContext'

/** Délai laissé à un envoi en cours quand on quitte l'éditeur. */
const LEAVE_FLUSH_MS = 3000

interface ImportProposal {
  documents: DocumentMeta[]
  phase: 'ask' | 'working' | 'done'
  progress: number
  report: ImportReport | null
}

/**
 * Ce que l'éditeur MCD est en train de travailler : un document
 * personnel, la base ou le corrigé d'un devoir, le travail d'un élève
 * sur un devoir, ou un modèle consulté sans y toucher. La cible décide
 * du titre affiché, du renommage, de la lecture seule et du retour.
 */
type EditorTarget =
  | { kind: 'document' }
  | {
      kind: 'assignment'
      classroomId: string
      assignmentId: string
      field: AssignmentField
      title: string
    }
  | { kind: 'work'; classroomId: string; assignmentId: string }
  | {
      kind: 'review'
      classroomId: string
      assignmentId: string
      /** Rendu consulté, ou null pour un corrigé libéré. */
      submissionId: string | null
      label: string
    }

/** Modèle ouvert, sa sauvegarde automatique, et l'espace d'où il vient. */
interface OpenedSession {
  spaceKey: string
  document: OpenedDocument
  saver: DocumentSaver
  cloud: boolean
  target: EditorTarget
}

const FIELD_LABEL: Record<AssignmentField, string> = {
  base: 'Base du devoir',
  solution: 'Corrigé du devoir',
}

/** Ce que la barre de l'éditeur propose, selon ce qui est ouvert. */
interface EditorChrome {
  contentLabel?: string
  backLabel?: string
  /** Le titre se renomme depuis la barre : documents personnels seulement. */
  canRename: boolean
  /** Nouveau document et Ouvrir un fichier : hors de l'espace documents, non. */
  documentActions: boolean
  readOnly: boolean
}

function editorChrome(target: EditorTarget): EditorChrome {
  switch (target.kind) {
    case 'document':
      return { canRename: true, documentActions: true, readOnly: false }
    case 'assignment':
      return {
        contentLabel: FIELD_LABEL[target.field],
        backLabel: 'Retour au devoir',
        canRename: false,
        documentActions: false,
        readOnly: false,
      }
    case 'work':
      // Le travail de l'élève est son document : il peut le renommer.
      return { backLabel: 'Retour au devoir', canRename: true, documentActions: false, readOnly: false }
    case 'review':
      return {
        contentLabel: target.label,
        backLabel: target.submissionId === null ? 'Retour au devoir' : 'Retour au rendu',
        canRename: false,
        documentActions: false,
        readOnly: true,
      }
  }
}

/**
 * Racine de Meriz : l'accueil de l'espace courant tant qu'aucun
 * document n'est ouvert, sinon l'éditeur. L'espace suit la session :
 * les documents du compte connecté, ou ceux de cet appareil.
 */
export function App() {
  const { session, account, notice, clearNotice } = useSession()

  // Espace local, inchangé sans compte : l'ancien plan de travail
  // unique devient au premier lancement un document « Mon document ».
  const [localStore] = useState(() => {
    const store = browserDocumentStore()
    store.migrateLegacyAutosave()
    return store
  })
  const [localRepository] = useState(() => createLocalRepository(localStore))
  const [storage] = useState(() => browserStorage())

  const repository: DocumentRepository =
    account.kind === 'cloud' ? account.repository : localRepository
  const spaceKey = account.key
  const cloud = account.kind === 'cloud'

  // Document ouvert, avec sa sauvegarde automatique, rattaché à l'espace
  // qui l'a ouvert.
  const [opened, setOpened] = useState<OpenedSession | null>(null)
  const [authMode, setAuthMode] = useState<AuthMode | null>(null)
  const [homeAnnouncement, setHomeAnnouncement] = useState<string | null>(null)
  const [proposal, setProposal] = useState<ImportProposal | null>(null)
  // Page de l'espace connecté, gardée pendant l'édition : fermer un
  // document ramène à la page d'où on l'a ouvert.
  const [page, setPage] = useState<ConnectedPage>('home')
  const [classroomOpening, setClassroomOpening] = useState<ClassroomOpening | null>(null)
  // Compteur de navigation : chaque clic remonte la page, à neuf.
  const [navigation, setNavigation] = useState(0)

  const navigate = useCallback((next: ConnectedPage, opening: ClassroomOpening | null = null) => {
    setHomeAnnouncement(null)
    setClassroomOpening(opening)
    setPage(next)
    setNavigation((count) => count + 1)
  }, [])

  // Changement de compte : le document ouvert appartient à l'espace
  // précédent, il est refermé d'office.
  const current = opened && opened.spaceKey === spaceKey ? opened : null
  useEffect(() => {
    // Nouveau compte : on repart de l'accueil, jamais d'un écran de l'ancien.
    setPage('home')
    setClassroomOpening(null)
    setOpened((previous) => {
      if (previous && previous.spaceKey !== spaceKey) {
        previous.saver.dispose()
        return null
      }
      return previous
    })
  }, [spaceKey])

  /** Ouvre un document de l'espace, pour lui-même ou comme travail sur un devoir. */
  const openStoredDocument = useCallback(
    async (id: string, target: EditorTarget): Promise<ApiError | null> => {
      const result = await repository.open(id)
      if (!result.ok) {
        return result.error
      }
      const saver = repository.createSaver(result.value)
      setHomeAnnouncement(null)
      setOpened((previous) => {
        previous?.saver.dispose()
        return { spaceKey, document: result.value.document, saver, cloud, target }
      })
      return null
    },
    [repository, spaceKey, cloud],
  )

  const openDocument = useCallback(
    (id: string) => openStoredDocument(id, { kind: 'document' }),
    [openStoredDocument],
  )

  /** Le document de travail d'un élève sur un devoir : retour au devoir en fermant. */
  const openWorkDocument = useCallback(
    (classroomId: string, assignmentId: string, documentId: string) =>
      openStoredDocument(documentId, { kind: 'work', classroomId, assignmentId }),
    [openStoredDocument],
  )

  const createAndOpen = useCallback(
    async (name: string, state?: McdEditorState, mpdSettings?: MpdSettings): Promise<ApiError | null> => {
      const created = await repository.create(name, state, mpdSettings)
      return created.ok ? openDocument(created.value.id) : created.error
    },
    [repository, openDocument],
  )

  const newDocument = useCallback(
    () => createAndOpen(repository.nextNewDocumentName()),
    [repository, createAndOpen],
  )

  const openExample = useCallback(
    () => createAndOpen(EXAMPLE_NAME, { mcd: exampleMcd, layout: exampleLayout }),
    [createAndOpen],
  )

  const importFile = useCallback(
    async (file: File): Promise<string | null> => {
      const result = await importModelFile(file)
      if (!result.ok) {
        return result.error
      }
      const error = await createAndOpen(result.name, result.state, result.mpdSettings)
      return error ? error.message : null
    },
    [createAndOpen],
  )

  /**
   * Ouvre l'outil MCD sur la base ou le corrigé d'un devoir. Le contenu
   * vient du serveur ; un contenu absent ou illisible donne un modèle
   * vide, pour que le prof puisse commencer.
   */
  const openAssignmentModel = useCallback(
    (assignment: { id: string; classroomId: string; title: string }, field: AssignmentField, content: string | null) => {
      if (account.kind !== 'cloud') return
      const parsed = content === null ? null : parseModelFile(content)
      const document: OpenedDocument = {
        meta: {
          id: `${assignment.id}:${field}`,
          name: assignment.title,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        state: parsed && parsed.ok ? parsed.state : emptyEditorState(),
        mpdSettings: (parsed && parsed.ok ? parsed.mpdSettings : null) ?? DEFAULT_MPD_SETTINGS,
      }
      const saver = createAssignmentSaver({
        client: account.client,
        assignmentId: assignment.id,
        field,
        title: assignment.title,
        initialContent: content,
      })
      setHomeAnnouncement(null)
      setOpened((previous) => {
        previous?.saver.dispose()
        return {
          spaceKey,
          document,
          saver,
          cloud,
          target: {
            kind: 'assignment',
            classroomId: assignment.classroomId,
            assignmentId: assignment.id,
            field,
            title: assignment.title,
          },
        }
      })
    },
    [account, spaceKey, cloud],
  )

  /**
   * Ouvre un modèle en consultation : le rendu d'un élève pour son prof,
   * ou un corrigé libéré. Rien n'est enregistré, rien ne se modifie.
   */
  const openReadOnlyModel = useCallback(
    (model: ReadOnlyModel) => {
      const parsed = parseModelFile(model.content)
      const now = new Date().toISOString()
      const document: OpenedDocument = {
        meta: { id: model.key, name: model.name, createdAt: now, updatedAt: now },
        state: parsed.ok ? parsed.state : emptyEditorState(),
        mpdSettings: (parsed.ok ? parsed.mpdSettings : null) ?? DEFAULT_MPD_SETTINGS,
      }
      setHomeAnnouncement(null)
      setOpened((previous) => {
        previous?.saver.dispose()
        return {
          spaceKey,
          document,
          saver: createInertSaver(),
          cloud,
          target: {
            kind: 'review',
            classroomId: model.classroomId,
            assignmentId: model.assignmentId,
            submissionId: model.submissionId,
            label: model.label,
          },
        }
      })
    },
    [spaceKey, cloud],
  )

  const rename = useCallback(
    async (name: string): Promise<boolean> => {
      if (!current) return false
      const renamed = await repository.rename(current.document.meta.id, name)
      if (!renamed.ok) return false
      setOpened((previous) =>
        previous ? { ...previous, document: { ...previous.document, meta: renamed.value } } : previous,
      )
      return true
    },
    [repository, current],
  )

  const leaveEditor = useCallback(async () => {
    if (current) {
      // On laisse un instant à l'envoi ; hors ligne, le travail reste gardé.
      await Promise.race([
        current.saver.flush(),
        new Promise((resolve) => setTimeout(resolve, LEAVE_FLUSH_MS)),
      ])
      current.saver.dispose()
    }
    setOpened(null)
    // Tout ce qui vient d'un devoir y retourne : on ne retombe jamais
    // sur l'accueil après avoir dessiné une base, travaillé ou consulté.
    const target = current?.target
    if (target && target.kind !== 'document') {
      navigate('classes', {
        id: target.classroomId,
        initial: null,
        message: null,
        assignmentId: target.assignmentId,
        submissionId: target.kind === 'review' ? (target.submissionId ?? undefined) : undefined,
      })
    }
  }, [current, navigate])

  /* ---------------- Proposition d'import des documents locaux ---------------- */

  useEffect(() => {
    if (account.kind !== 'cloud' || session.status !== 'signed-in') {
      setProposal(null)
      return
    }
    const locals = localStore.listDocuments()
    const ids = new Set(unofferedLocalIds(storage.storage, account.userId, locals.map((m) => m.id)))
    const candidates = locals.filter((meta) => ids.has(meta.id))
    setProposal(candidates.length > 0 ? { documents: candidates, phase: 'ask', progress: 0, report: null } : null)
  }, [account, session.status, localStore, storage])

  const runImport = useCallback(async () => {
    if (!proposal || account.kind !== 'cloud') return
    setProposal({ ...proposal, phase: 'working', progress: 0 })
    const importedIds: string[] = []
    const failed: string[] = []
    let done = 0
    for (const meta of proposal.documents) {
      const local = localStore.loadDocument(meta.id)
      const created = local
        ? await repository.create(meta.name, local.state, local.mpdSettings)
        : { ok: false as const, error: apiError('storage', null, 'Document local illisible.') }
      if (created.ok) {
        importedIds.push(meta.id)
      } else {
        failed.push(meta.name)
      }
      done += 1
      setProposal((current) => (current ? { ...current, progress: done } : current))
    }
    // Seuls les documents réellement copiés sont marqués : les autres
    // seront reproposés, et les originaux locaux restent intacts.
    markOffered(storage.storage, account.userId, importedIds)
    setProposal((current) =>
      current ? { ...current, phase: 'done', report: { imported: importedIds.length, failed } } : current,
    )
  }, [proposal, account, localStore, repository, storage])

  const keepLocal = useCallback(() => {
    if (!proposal || account.kind !== 'cloud') return
    markOffered(storage.storage, account.userId, proposal.documents.map((meta) => meta.id))
    setProposal(null)
  }, [proposal, account, storage])

  /* ------------------------------ Rendu ------------------------------ */

  const showAuth = useCallback((mode: AuthMode) => {
    setHomeAnnouncement(null)
    setAuthMode(mode)
  }, [])

  if (!current && authMode) {
    return (
      <AuthPage
        mode={authMode}
        onModeChange={setAuthMode}
        onBack={() => setAuthMode(null)}
        onAuthenticated={(message) => {
          setHomeAnnouncement(message)
          setAuthMode(null)
        }}
      />
    )
  }

  if (account.kind === 'loading' || account.kind === 'offline-unknown') {
    return <AccountLoading kind={account.kind} />
  }

  const importDialog = proposal && (
    <ImportLocalDialog
      open
      documents={proposal.documents}
      phase={proposal.phase}
      progress={proposal.progress}
      report={proposal.report}
      onImport={() => void runImport()}
      onKeepLocal={keepLocal}
      onLater={() => setProposal(null)}
      onClose={() => setProposal(null)}
    />
  )

  // Espace connecté : accueil selon le rôle, classes, travail, profil.
  // Chaque page est remontée par compte et à chaque navigation : ses
  // données ne survivent jamais à un changement de compte.
  if (!current && session.status === 'signed-in' && account.kind === 'cloud') {
    const pageKey = `${account.key}:${navigation}`
    const homeProps = {
      user: session.user,
      client: account.client,
      repository,
      onOpenDocument: openDocument,
      onNewDocument: newDocument,
      onOpenClassroom: (opening: ClassroomOpening) => navigate('classes', opening),
      onShowWork: () => navigate('work'),
      announcement: homeAnnouncement,
    }
    return (
      <>
        <ConnectedShell
          user={session.user}
          page={page}
          onNavigate={(next) => navigate(next)}
          notice={notice}
          onClearNotice={clearNotice}
        >
          {page === 'home' &&
            (session.user.role === 'teacher' ? (
              <TeacherHome key={pageKey} {...homeProps} />
            ) : (
              <StudentHome key={pageKey} {...homeProps} />
            ))}
          {page === 'classes' && (
            <ClassesPage
              key={pageKey}
              user={session.user}
              client={account.client}
              opening={classroomOpening}
              onEditAssignmentModel={openAssignmentModel}
              onOpenWorkDocument={openWorkDocument}
              onOpenReadOnlyModel={openReadOnlyModel}
            />
          )}
          {page === 'work' && (
            <WorkPage
              key={pageKey}
              repository={repository}
              onOpenDocument={openDocument}
              onNewDocument={newDocument}
              onOpenExample={openExample}
              onImportFile={importFile}
            />
          )}
          {page === 'profile' && (
            <ProfilePage
              key={pageKey}
              user={session.user}
              client={account.client}
              onShowClasses={() => navigate('classes')}
            />
          )}
        </ConnectedShell>
        {importDialog}
      </>
    )
  }

  // Sans compte, ou compte gardé mais serveur injoignable au démarrage
  // (profil et rôle inconnus) : l'accueil des documents, sans coquille.
  if (!current) {
    return (
      <>
        <DocumentsHome
          key={spaceKey}
          repository={repository}
          cloud={cloud}
          storageWarning={!cloud && !localStore.isPersistent}
          onOpenDocument={openDocument}
          onNewDocument={newDocument}
          onOpenExample={openExample}
          onImportFile={importFile}
          onShowSignIn={() => showAuth('sign-in')}
          onShowSignUp={() => showAuth('sign-up')}
          announcement={homeAnnouncement}
          notice={notice}
          onClearNotice={clearNotice}
        />
        {importDialog}
      </>
    )
  }
  const chrome = editorChrome(current.target)
  return (
    <>
      <Editor
        // Une clé par document : historique, sélection et vues repartent
        // à zéro quand on change de document ou de compte.
        key={`${spaceKey}:${current.document.meta.id}`}
        openedDocument={current.document}
        saver={current.saver}
        cloud={current.cloud}
        readOnly={chrome.readOnly}
        onRename={chrome.canRename ? rename : undefined}
        onBackToDocuments={() => void leaveEditor()}
        contentLabel={chrome.contentLabel}
        backLabel={chrome.backLabel}
        onNewDocument={chrome.documentActions ? () => void newDocument() : undefined}
        onImportFile={chrome.documentActions ? importFile : undefined}
      />
      {importDialog}
    </>
  )
}
