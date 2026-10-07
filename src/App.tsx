import { useCallback, useEffect, useRef, useState } from 'react'
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
import { getLiveSnapshot } from './lib/liveApi'
import { createLiveTransport } from './lib/liveTransport'
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
import { CorrectionsPage } from './components/CorrectionsPage'
import type { CorrectionOpening } from './components/CorrectionsPage'
import type { LiveCoedition, ReadOnlyModel } from './components/assignments/types'
import { GroupsPage } from './components/groups/GroupsPage'
import type { GroupOpening } from './components/groups/GroupsPage'
import type { CollaborationInfo } from './components/useCollaboration'
import type { CollabUser } from './model/collabProvider'
import type { SessionState } from './lib/sessionState'
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
  | {
      kind: 'work'
      classroomId: string
      assignmentId: string
      origin: EditorOrigin
      /** Devoir au suivi ouvert : le travail se partage avec le prof. */
      live: boolean
    }
  | {
      kind: 'review'
      classroomId: string
      assignmentId: string
      /** Rendu consulté, ou null pour un corrigé libéré. */
      submissionId: string | null
      label: string
      origin: EditorOrigin
      /** Travail suivi en direct : l'élève observé et son document. */
      live: { studentId: number; documentId: string } | null
    }
  /** Un document partagé d'un groupe, travaillé entre pairs. */
  | {
      kind: 'group'
      groupId: string
      groupName: string
      documentId: string
    }
  /** Le travail d'un élève, corrigé à deux par son prof. */
  | {
      kind: 'coedit'
      classroomId: string
      assignmentId: string
      studentId: number
      documentId: string
      label: string
      origin: EditorOrigin
    }

/** La page d'où l'outil a été ouvert, celle où fermer doit ramener. */
type EditorOrigin = 'classes' | 'corrections' | 'work'

/**
 * Le contexte collaboratif d'une cible, ou rien. L'élève partage son
 * travail quand le devoir est suivi, le prof entre dans le canal
 * seulement pour corriger à deux, et les membres d'un groupe se
 * retrouvent sur ses documents partagés. Une simple lecture n'y entre
 * pas :
 * l'élève n'a pas à voir arriver quelqu'un chaque fois qu'on le regarde,
 * la date de lecture suffit à le lui dire.
 */
function collaborationFor(
  target: EditorTarget,
  session: SessionState,
  documentId: string | null,
): CollaborationInfo | undefined {
  if (session.status !== 'signed-in' || documentId === null) {
    return undefined
  }
  const user = session.user
  const me: CollabUser = {
    id: user.id,
    name: user.name,
    firstName: user.firstName,
    role: user.role,
    avatarBg: user.avatarBg,
    avatarFg: user.avatarFg,
  }
  if (target.kind === 'work' && target.live) {
    return { documentId, me, role: 'owner' }
  }
  if (target.kind === 'coedit') {
    return { documentId: target.documentId, me, role: 'guest' }
  }
  if (target.kind === 'group') {
    return { documentId: target.documentId, me, role: 'member' }
  }
  return undefined
}

/**
 * Ce qu'une page doit rouvrir en arrivant. Seule la page visée lit sa
 * charge : personne d'autre n'a à la comprendre.
 */
type Opening =
  | { page: 'classes'; classroom: ClassroomOpening }
  | { page: 'corrections'; correction: CorrectionOpening }
  | { page: 'work'; assignmentId: string }
  | { page: 'groups'; group: GroupOpening }

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
      // Le titre est celui de l'exercice, donné par le prof : on l'affiche,
      // on ne le renomme pas. Le serveur le réécrit de toute façon chaque
      // fois que l'élève reprend le devoir.
      return {
        contentLabel: 'Devoir',
        backLabel: 'Retour au devoir',
        canRename: false,
        documentActions: false,
        readOnly: false,
      }
    case 'review':
      return {
        contentLabel: target.label,
        backLabel: target.submissionId === null ? 'Retour au devoir' : 'Retour au rendu',
        canRename: false,
        documentActions: false,
        readOnly: true,
      }
    case 'group':
      /*
       * Document du groupe : tout membre y écrit et l'enregistre. Le nom
       * est commun, donc il se renomme depuis la liste du groupe, pas
       * depuis la barre, et les actions de documents personnels n'ont
       * rien à faire ici.
       */
      return {
        contentLabel: `Groupe « ${target.groupName} »`,
        backLabel: 'Retour au groupe',
        canRename: false,
        documentActions: false,
        readOnly: false,
      }
    case 'coedit':
      // Correction à deux : le prof écrit dans le modèle partagé, mais
      // c'est l'élève qui l'enregistre, et le titre reste le sien.
      return {
        contentLabel: target.label,
        backLabel: 'Retour au suivi',
        canRename: false,
        documentActions: false,
        readOnly: false,
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
  const [opening, setOpening] = useState<Opening | null>(null)
  // Compteur de navigation : chaque clic remonte la page, à neuf.
  const [navigation, setNavigation] = useState(0)

  const navigate = useCallback((next: ConnectedPage, target: Opening | null = null) => {
    setHomeAnnouncement(null)
    setOpening(target)
    setPage(next)
    setNavigation((count) => count + 1)
  }, [])

  /**
   * D'où l'on ouvre l'outil MCD, donc où le fermer ramène. Un rendu
   * ouvert depuis « À corriger » y retourne, pas dans la classe.
   */
  const editorOrigin: EditorOrigin = page === 'corrections' ? 'corrections' : page === 'work' ? 'work' : 'classes'

  // Changement de compte : le document ouvert appartient à l'espace
  // précédent, il est refermé d'office.
  const current = opened && opened.spaceKey === spaceKey ? opened : null
  useEffect(() => {
    // Nouveau compte : on repart de l'accueil, jamais d'un écran de l'ancien.
    setPage('home')
    setOpening(null)
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
      // Un document de groupe est partagé : il ne passe pas par le cache
      // personnel, sinon il s'afficherait dans « Mes documents » et
      // pourrait être recréé en document personnel.
      const result = await repository.open(id, target.kind === 'group')
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

  /** Un document partagé d'un groupe : co-édité entre pairs. */
  const openGroupDocument = useCallback(
    (groupId: string, groupName: string, documentId: string) => {
      void openStoredDocument(documentId, { kind: 'group', groupId, groupName, documentId })
    },
    [openStoredDocument],
  )

  /** Le document de travail d'un élève sur un devoir : retour au devoir en fermant. */
  const openWorkDocument = useCallback(
    (classroomId: string, assignmentId: string, documentId: string, live = false) =>
      openStoredDocument(documentId, {
        kind: 'work',
        classroomId,
        assignmentId,
        origin: editorOrigin,
        live,
      }),
    [openStoredDocument, editorOrigin],
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
      // Point de départ de l'observation : ce contenu est déjà à l'écran.
      lastLiveContent.current = model.live ? model.content : null
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
            origin: editorOrigin,
            live: model.live ?? null,
          },
        }
      })
    },
    [spaceKey, cloud, editorOrigin],
  )

  /**
   * Corriger à deux le travail d'un élève. Le document part **vide** :
   * il se remplit par la synchronisation Yjs. Semer ici le contenu déjà
   * affiché doublerait tout le modèle à la fusion.
   *
   * Rien n'est enregistré de ce côté : c'est l'élève propriétaire qui
   * persiste l'état partagé, par sa route habituelle.
   */
  const openCollaboration = useCallback(
    (model: LiveCoedition) => {
      const now = new Date().toISOString()
      const document: OpenedDocument = {
        meta: { id: `${model.documentId}:coedit`, name: model.name, createdAt: now, updatedAt: now },
        state: emptyEditorState(),
        mpdSettings: DEFAULT_MPD_SETTINGS,
      }
      lastLiveContent.current = null
      setHomeAnnouncement(null)
      setOpened((previous) => {
        previous?.saver.dispose()
        return {
          spaceKey,
          document,
          saver: createInertSaver(),
          cloud,
          target: {
            kind: 'coedit',
            classroomId: model.classroomId,
            assignmentId: model.assignmentId,
            studentId: model.studentId,
            documentId: model.documentId,
            label: model.label,
            origin: editorOrigin,
          },
        }
      })
    },
    [spaceKey, cloud, editorOrigin],
  )

  /* ---------------- Observation en direct ---------------- */

  // Dernier contenu adopté, pour ne remplacer l'état que s'il a changé.
  const lastLiveContent = useRef<string | null>(null)
  const liveTarget = current?.target.kind === 'review' ? current.target.live : null
  const liveAssignmentId = current?.target.kind === 'review' ? current.target.assignmentId : null

  /**
   * Adopte un modèle observé. Seul l'état est remplacé, jamais
   * l'identifiant du document : l'éditeur ne remonte pas, donc le
   * cadrage et la vue du prof sont gardés. Un contenu identique au
   * précédent ne change rien, un contenu illisible non plus : on garde
   * alors la dernière image bonne.
   */
  const adoptLiveContent = useCallback((content: string) => {
    if (content === lastLiveContent.current) {
      return
    }
    lastLiveContent.current = content
    const parsed = parseModelFile(content)
    if (!parsed.ok) {
      return
    }
    setOpened((previous) =>
      previous ? { ...previous, document: { ...previous.document, state: parsed.state } } : previous,
    )
  }, [])

  /**
   * Un travail observé arrive en direct par websocket, et le
   * rafraîchissement régulier reste en filet : si le direct ne s'établit
   * pas ou retombe, l'image continue d'avancer. Tout se ferme avec la
   * vue, et s'interrompt quand l'onglet passe en arrière-plan.
   */
  useEffect(() => {
    if (account.kind !== 'cloud' || liveTarget === null || liveAssignmentId === null) {
      return
    }
    const client = account.client
    const transport = createLiveTransport({
      assignmentId: liveAssignmentId,
      studentId: liveTarget.studentId,
      fetchSnapshot: async (stillWanted) => {
        const result = await getLiveSnapshot(client, liveAssignmentId, liveTarget.studentId)
        if (stillWanted() && result.ok) {
          adoptLiveContent(result.value.content)
        }
      },
      onContent: adoptLiveContent,
    })
    transport.start()
    return () => transport.stop()
  }, [account, liveTarget, liveAssignmentId, adoptLiveContent])

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
    // Et on revient par la porte d'entrée, celle de la page d'origine.
    const target = current?.target
    if (!target || target.kind === 'document') {
      return
    }
    if (target.kind === 'group') {
      navigate('groups', {
        page: 'groups',
        group: { id: target.groupId, initial: null, message: null, tab: 'documents' },
      })
      return
    }
    const origin =
      target.kind === 'work' || target.kind === 'review' || target.kind === 'coedit'
        ? target.origin
        : 'classes'
    if (origin === 'corrections' && target.kind === 'review' && target.submissionId !== null) {
      navigate('corrections', {
        page: 'corrections',
        correction: {
          submissionId: target.submissionId,
          classroomId: target.classroomId,
          assignmentId: target.assignmentId,
        },
      })
      return
    }
    if (origin === 'work') {
      navigate('work', { page: 'work', assignmentId: target.assignmentId })
      return
    }
    navigate('classes', {
      page: 'classes',
      classroom: {
        id: target.classroomId,
        initial: null,
        message: null,
        assignmentId: target.assignmentId,
        submissionId: target.kind === 'review' ? (target.submissionId ?? undefined) : undefined,
        // Un travail observé ou corrigé à deux ramène au suivi, là où le
        // prof l'a ouvert.
        assignmentTab:
          target.kind === 'coedit' || (target.kind === 'review' && target.live !== null)
            ? 'suivi'
            : undefined,
      },
    })
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
      onOpenClassroom: (classroom: ClassroomOpening) => navigate('classes', { page: 'classes', classroom }),
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
              <TeacherHome
                key={pageKey}
                {...homeProps}
                onShowCorrections={() => navigate('corrections')}
              />
            ) : (
              <StudentHome key={pageKey} {...homeProps} />
            ))}
          {page === 'classes' && (
            <ClassesPage
              key={pageKey}
              user={session.user}
              client={account.client}
              opening={opening?.page === 'classes' ? opening.classroom : null}
              onEditAssignmentModel={openAssignmentModel}
              onOpenWorkDocument={openWorkDocument}
              onOpenReadOnlyModel={openReadOnlyModel}
              onStartLiveCoedition={openCollaboration}
            />
          )}
          {page === 'groups' && (
            <GroupsPage
              key={pageKey}
              client={account.client}
              opening={opening?.page === 'groups' ? opening.group : null}
              onOpenGroupDocument={openGroupDocument}
            />
          )}
          {page === 'corrections' && (
            <CorrectionsPage
              key={pageKey}
              client={account.client}
              opening={opening?.page === 'corrections' ? opening.correction : null}
              onOpenReadOnlyModel={openReadOnlyModel}
            />
          )}
          {page === 'work' && (
            <WorkPage
              key={pageKey}
              client={account.client}
              repository={repository}
              openAssignmentId={opening?.page === 'work' ? opening.assignmentId : null}
              onOpenDocument={openDocument}
              onNewDocument={newDocument}
              onOpenExample={openExample}
              onImportFile={importFile}
              onOpenWorkDocument={openWorkDocument}
              onOpenReadOnlyModel={openReadOnlyModel}
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
  /*
   * Co-édition : seul un travail rattaché à un devoir suivi ouvre un
   * canal. L'élève y entre comme propriétaire, le prof d'abord en
   * spectateur, puis en correcteur s'il le décide. Un document
   * personnel, lui, ne se connecte à rien.
   */
  const collaboration = collaborationFor(current.target, session, account.kind === 'cloud'
    ? current.document.meta.id
    : null)
  const startCollaboration =
    current.target.kind === 'review' && current.target.live !== null
      ? () => {
          const target = current.target as Extract<EditorTarget, { kind: 'review' }>
          openCollaboration({
            classroomId: target.classroomId,
            assignmentId: target.assignmentId,
            studentId: target.live!.studentId,
            documentId: target.live!.documentId,
            name: current.document.meta.name,
            label: target.label,
          })
        }
      : undefined
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
        collaboration={collaboration}
        onStartCollaboration={startCollaboration}
      />
      {importDialog}
    </>
  )
}
