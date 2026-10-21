import { t } from "./i18n/runtime"
import { useLanguage } from "./lib/useLanguage"
import { lazy, Suspense, useCallback, useState } from 'react'
import { browserStorage } from './lib/browserStorage'
import { createLocalRepository } from './lib/documentRepository'
import type { DocumentRepository } from './lib/documentRepository'
import { browserDocumentStore } from './lib/documentStore'
import { DocumentsHome } from './components/DocumentsHome'
/*
 * L'éditeur arrive à la demande. Il est le seul chemin vers React Flow
 * et Yjs, quarante-trois pour cent du paquet : l'accueil, les classes,
 * le travail et le profil n'ont pas à les télécharger.
 */
const Editor = lazy(() => import('./components/Editor').then((m) => ({ default: m.Editor })))
import { readVerification, urlWithoutVerification } from './lib/verificationLanding'
import type { VerificationResult } from './lib/verificationLanding'
import { readPasswordReset, urlWithoutPasswordReset } from './lib/passwordResetLanding'
import type { PasswordResetLink } from './lib/passwordResetLanding'
import { AuthPage } from './components/AuthPage'
import { EmailVerifiedPage } from './components/EmailVerifiedPage'
import { NewPasswordPage } from './components/NewPasswordPage'
import type { AuthMode } from './components/AuthPage'
import { ImportLocalDialog } from './components/ImportLocalDialog'
import { AccountLoading } from './components/AccountLoading'
import { EditorLoading } from './components/EditorLoading'
import { ProfilePage } from './components/ProfilePage'
import { ClassesPage } from './components/ClassesPage'
import type { ClassroomOpening } from './components/ClassesPage'
import { CorrectionsPage } from './components/CorrectionsPage'
import { GroupsPage } from './components/groups/GroupsPage'
import { ConnectedShell } from './components/ConnectedShell'
import {
  collaborationFor,
  commentsDocumentId,
  editorChrome,
  returnTarget,
} from './components/editorTarget'
import type { EditorOrigin, EditorTarget, Opening } from './components/editorTarget'
import type { ConnectedPage } from './components/ConnectedShell'
import { StudentHome } from './components/StudentHome'
import { TeacherHome } from './components/TeacherHome'
import { WorkPage } from './components/WorkPage'
import { useSession } from './components/sessionContext'
import { useDocumentOpening } from './components/useDocumentOpening'
import { useLocalImportOffer } from './components/useLocalImportOffer'
import { useLiveObservation } from './components/useLiveObservation'


/**
 * Racine de Meriz : l'accueil de l'espace courant tant qu'aucun
 * document n'est ouvert, sinon l'éditeur. L'espace suit la session :
 * les documents du compte connecté, ou ceux de cet appareil.
 */
export function App() {
  useLanguage()
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

  const [authMode, setAuthMode] = useState<AuthMode | null>(null)
  /*
   * Retour d'un lien de confirmation d'adresse, lu une seule fois au
   * démarrage. Il prime sur tout le reste : le lien s'ouvre depuis une
   * boîte mail, souvent sans session et parfois sur un autre appareil.
   */
  const [verification, setVerification] = useState<VerificationResult | null>(() =>
    typeof window === 'undefined' ? null : readVerification(window.location.href),
  )
  /*
   * Lien de réinitialisation de mot de passe, lu une seule fois lui
   * aussi. Il mène droit ici, sans passer par l'API, et porte le jeton.
   */
  const [resetLink, setResetLink] = useState<PasswordResetLink | null>(() =>
    typeof window === 'undefined' ? null : readPasswordReset(window.location.href),
  )
  /** Adresse connue d'avance, posée dans le champ de la connexion. */
  const [knownEmail, setKnownEmail] = useState<string | undefined>(undefined)
  const [homeAnnouncement, setHomeAnnouncement] = useState<string | null>(null)
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

  const clearAnnouncement = useCallback(() => setHomeAnnouncement(null), [])
  const onSpaceChange = useCallback(() => {
    setPage('home')
    setOpening(null)
  }, [])

  /**
   * D'où l'on ouvre l'outil MCD, donc où le fermer ramène. Un rendu
   * ouvert depuis « À corriger » y retourne, pas dans la classe.
   */
  const editorOrigin: EditorOrigin = page === 'corrections' ? 'corrections' : page === 'work' ? 'work' : 'classes'

  /*
   * Le modèle travaillé : son ouverture par onze chemins, son
   * renommage, son observation en direct et sa fermeture. Le hook ne
   * navigue pas, il rend la main.
   */
  const {
    current,
    openDocument,
    openGroupDocument,
    openWorkDocument,
    newDocument,
    openExample,
    importFile,
    openAssignmentModel,
    openReadOnlyModel,
    openCollaboration,
    observeCollaboration,
    rename,
    closeDocument,
    adoptLiveContent,
  } = useDocumentOpening({
    repository,
    spaceKey,
    cloud,
    account,
    editorOrigin,
    clearAnnouncement,
    onSpaceChange,
  })

  const leaveEditor = useCallback(async () => {
    // L'ordre compte : on ferme, puis on revient par la porte d'entrée
    // de la page d'origine, que la cible ouverte désigne.
    const back = current ? returnTarget(current.target) : null
    await closeDocument()
    if (back) {
      navigate(back.page, back.opening)
    }
  }, [current, closeDocument, navigate])

  // Un travail suivi avance sous les yeux du prof, sans qu'il recharge.
  useLiveObservation({ account, target: current?.target ?? null, onContent: adoptLiveContent })

  // L'offre de copier les documents de cet appareil dans le compte.
  const { proposal, runImport, keepLocal, dismiss } = useLocalImportOffer({
    account,
    session,
    localStore,
    storage,
    repository,
  })

  /* ------------------------------ Rendu ------------------------------ */

  const showAuth = useCallback((mode: AuthMode) => {
    setHomeAnnouncement(null)
    setAuthMode(mode)
  }, [])

  if (verification !== null) {
    // Continuer efface le résultat de l'adresse : il ne vaut qu'une
    // fois, et n'a rien à faire dans un favori ni dans un historique.
    const leave = () => {
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', urlWithoutVerification(window.location.href))
      }
      setVerification(null)
    }
    return (
      <EmailVerifiedPage
        result={verification}
        onContinue={leave}
        onSignIn={() => {
          leave()
          showAuth('sign-in')
        }}
      />
    )
  }

  if (resetLink !== null) {
    // Un jeton de réinitialisation ouvre un compte : il quitte l'adresse
    // dès qu'on a fini, comme le résultat de vérification.
    const leave = () => {
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', urlWithoutPasswordReset(window.location.href))
      }
      setResetLink(null)
    }
    return (
      <NewPasswordPage
        link={resetLink}
        onContinue={leave}
        onSignIn={(email) => {
          leave()
          setKnownEmail(email)
          showAuth('sign-in')
        }}
        onAskNewLink={() => {
          leave()
          showAuth('forgot')
        }}
      />
    )
  }

  if (!current && authMode) {
    return (
      <AuthPage
        mode={authMode}
        initialEmail={knownEmail}
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
      onLater={dismiss}
      onClose={dismiss}
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
      onOpenGroup: (id: string) =>
        navigate('groups', { page: 'groups', group: { id, initial: null, message: null } }),
      onShowWork: () => navigate('work'),
      onShowClasses: () => navigate('classes'),
      onShowGroups: () => navigate('groups'),
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
                onOpenCorrection={(correction) => navigate('corrections', { page: 'corrections', correction })}
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
              student={session.user.role !== 'teacher'}
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
              onAccountDeleted={() =>
                setHomeAnnouncement(
                  t("Votre compte a été supprimé. Vos documents de cet appareil sont toujours là."),
                )
              }
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
  const commentsDocument = commentsDocumentId(current.target, current.document)
  const comments =
    account.kind === 'cloud' && commentsDocument !== null && session.status === 'signed-in'
      ? {
          client: account.client,
          documentId: commentsDocument,
          me: {
            id: session.user.id,
            name: session.user.name,
            firstName: session.user.firstName,
            role: session.user.role,
            avatarBg: session.user.avatarBg,
            avatarFg: session.user.avatarFg,
          },
        }
      : undefined
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
            labelMessage: target.labelMessage ? { ...target.labelMessage, source: "Travail de {0}, correction à deux" } : undefined,
          })
        }
      : undefined
  return (
    <Suspense fallback={<EditorLoading />}>
      <Editor
        // Une clé par document : historique, sélection et vues repartent
        // à zéro quand on change de document ou de compte.
        key={`${spaceKey}:${current.document.meta.id}`}
        openedDocument={current.document}
        saver={current.saver}
        cloud={current.cloud}
        readOnly={chrome.readOnly}
        comments={comments}
        onRename={chrome.canRename ? rename : undefined}
        onBackToDocuments={() => void leaveEditor()}
        contentLabel={chrome.contentLabel}
        backLabel={chrome.backLabel}
        onNewDocument={chrome.documentActions ? () => void newDocument() : undefined}
        onImportFile={chrome.documentActions ? importFile : undefined}
        collaboration={collaboration}
        onStartCollaboration={startCollaboration}
        onStopCollaboration={current.target.kind === 'coedit' ? observeCollaboration : undefined}
      />
      {importDialog}
    </Suspense>
  )
}
