import { useCallback, useEffect, useState } from 'react'
import type { DocumentMeta, OpenedDocument } from './model/document'
import type { McdEditorState } from './model/mcdReducer'
import type { MpdSettings } from './model/mpd'
import { EXAMPLE_NAME, exampleLayout, exampleMcd } from './model/example'
import type { ApiError } from './lib/apiClient'
import { apiError } from './lib/apiClient'
import { browserStorage } from './lib/browserStorage'
import { createLocalRepository } from './lib/documentRepository'
import type { DocumentRepository, DocumentSaver } from './lib/documentRepository'
import { browserDocumentStore } from './lib/documentStore'
import { importModelFile } from './lib/importFile'
import { markOffered, unofferedLocalIds } from './lib/importOffers'
import { DocumentsHome } from './components/DocumentsHome'
import { Editor } from './components/Editor'
import { AuthPage } from './components/AuthPage'
import type { AuthMode } from './components/AuthPage'
import { ImportLocalDialog } from './components/ImportLocalDialog'
import type { ImportReport } from './components/ImportLocalDialog'
import { AccountLoading } from './components/AccountLoading'
import { useSession } from './components/sessionContext'

/** Délai laissé à un envoi en cours quand on quitte l'éditeur. */
const LEAVE_FLUSH_MS = 3000

interface ImportProposal {
  documents: DocumentMeta[]
  phase: 'ask' | 'working' | 'done'
  progress: number
  report: ImportReport | null
}

/** Document ouvert, sa sauvegarde automatique, et l'espace d'où il vient. */
interface OpenedSession {
  spaceKey: string
  document: OpenedDocument
  saver: DocumentSaver
  cloud: boolean
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

  // Changement de compte : le document ouvert appartient à l'espace
  // précédent, il est refermé d'office.
  const current = opened && opened.spaceKey === spaceKey ? opened : null
  useEffect(() => {
    setOpened((previous) => {
      if (previous && previous.spaceKey !== spaceKey) {
        previous.saver.dispose()
        return null
      }
      return previous
    })
  }, [spaceKey])

  const openDocument = useCallback(
    async (id: string): Promise<ApiError | null> => {
      const result = await repository.open(id)
      if (!result.ok) {
        return result.error
      }
      const saver = repository.createSaver(result.value)
      setHomeAnnouncement(null)
      setOpened((previous) => {
        previous?.saver.dispose()
        return { spaceKey, document: result.value.document, saver, cloud }
      })
      return null
    },
    [repository, spaceKey, cloud],
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
  }, [current])

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

  return (
    <>
      <Editor
        // Une clé par document : historique, sélection et vues repartent
        // à zéro quand on change de document ou de compte.
        key={`${spaceKey}:${current.document.meta.id}`}
        openedDocument={current.document}
        saver={current.saver}
        cloud={current.cloud}
        onRename={rename}
        onBackToDocuments={() => void leaveEditor()}
        onNewDocument={() => void newDocument()}
        onImportFile={importFile}
      />
      {importDialog}
    </>
  )
}
