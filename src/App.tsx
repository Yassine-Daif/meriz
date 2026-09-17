import { useCallback, useState } from 'react'
import type { McdEditorState } from './model/mcdReducer'
import type { MpdSettings } from './model/mpd'
import type { OpenedDocument } from './model/document'
import { EXAMPLE_NAME, exampleLayout, exampleMcd } from './model/example'
import { browserDocumentStore } from './lib/documentStore'
import { importModelFile } from './lib/importFile'
import { DocumentsHome } from './components/DocumentsHome'
import { Editor } from './components/Editor'
import { AuthPage } from './components/AuthPage'
import type { AuthMode } from './components/AuthPage'

/**
 * Racine de Meriz : l'accueil (liste des documents) tant qu'aucun
 * document n'est ouvert, sinon l'éditeur sur le document courant.
 * Les écrans de compte s'ouvrent depuis l'accueil.
 */
export function App() {
  // Stockage ouvert une fois ; l'ancien plan de travail unique devient
  // au premier lancement un document « Mon document ».
  const [store] = useState(() => {
    const documentStore = browserDocumentStore()
    documentStore.migrateLegacyAutosave()
    return documentStore
  })
  const [openedDocument, setOpenedDocument] = useState<OpenedDocument | null>(null)
  // Écran affiché quand aucun document n'est ouvert.
  const [authMode, setAuthMode] = useState<AuthMode | null>(null)
  // Message annoncé à l'arrivée sur l'accueil (connexion réussie).
  const [homeAnnouncement, setHomeAnnouncement] = useState<string | null>(null)

  const openDocument = useCallback(
    (id: string): boolean => {
      const loaded = store.loadDocument(id)
      if (loaded) {
        setHomeAnnouncement(null)
        setOpenedDocument(loaded)
      }
      return loaded !== null
    },
    [store],
  )

  const createAndOpen = useCallback(
    (name: string, state?: McdEditorState, mpdSettings?: MpdSettings): boolean => {
      const meta = store.createDocument(name, state, mpdSettings)
      return meta !== null && openDocument(meta.id)
    },
    [store, openDocument],
  )

  const newDocument = useCallback(
    () => createAndOpen(store.nextNewDocumentName()),
    [store, createAndOpen],
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
      return createAndOpen(result.name, result.state, result.mpdSettings)
        ? null
        : "Le document n'a pas pu être enregistré dans ce navigateur (stockage plein ou indisponible)."
    },
    [createAndOpen],
  )

  const currentId = openedDocument?.meta.id

  const saveContent = useCallback(
    (state: McdEditorState, mpdSettings: MpdSettings) =>
      currentId !== undefined && store.saveContent(currentId, state, mpdSettings),
    [store, currentId],
  )

  const rename = useCallback(
    (name: string) => {
      if (currentId === undefined) {
        return
      }
      const meta = store.renameDocument(currentId, name)
      if (meta) {
        setOpenedDocument((previous) => (previous ? { ...previous, meta } : previous))
      }
    },
    [store, currentId],
  )

  const showAuth = useCallback((mode: AuthMode) => {
    setHomeAnnouncement(null)
    setAuthMode(mode)
  }, [])

  if (!openedDocument && authMode) {
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

  if (!openedDocument) {
    return (
      <DocumentsHome
        store={store}
        onOpenDocument={openDocument}
        onNewDocument={newDocument}
        onOpenExample={openExample}
        onImportFile={importFile}
        onShowSignIn={() => showAuth('sign-in')}
        onShowSignUp={() => showAuth('sign-up')}
        announcement={homeAnnouncement}
      />
    )
  }

  return (
    <Editor
      // Une clé par document : historique, sélection et vues repartent
      // à zéro quand on change de document.
      key={openedDocument.meta.id}
      openedDocument={openedDocument}
      onContentChange={saveContent}
      onRename={rename}
      onBackToDocuments={() => setOpenedDocument(null)}
      onNewDocument={() => void newDocument()}
      onImportFile={importFile}
    />
  )
}
