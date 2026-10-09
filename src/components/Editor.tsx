import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import type { OpenedDocument } from '../model/document'
import { validate, validationErrors } from '../model/validate'
import { mcdToMld } from '../model/mld'
import { buildMpd } from '../model/mpd'
import type { MpdSettings, SqlDialect } from '../model/mpd'
import { findAssociation, findEntity, findLeg } from '../model/queries'
import type { DocumentSaver, SaveStatus } from '../lib/documentRepository'
import { isEditableTarget } from '../lib/keyboard'
import { EMPTY_SELECTION } from '../canvas/selection'
import type { CanvasSelection } from '../canvas/selection'
import type { ViewId } from './views'
import { useModelDoc } from './useModelDoc'
import { useCollaboration } from './useCollaboration'
import { useSharedSeed } from './useSharedSeed'
import type { CollaborationInfo } from './useCollaboration'
import { CodeView } from './CodeView'
import { CollaborationBanner } from './CollaborationBanner'
import type { CommentsAccess } from './useComments'
import { TopBar } from './TopBar'
import { NavRail } from './NavRail'
import { McdView } from './McdView'
import { DictionaryView } from './DictionaryView'
import { MldView } from './MldView'
import { MpdView } from './MpdView'
import { SqlView } from './SqlView'
import { LearnView } from './LearnView'
import { AboutView } from './AboutView'
import { SkipLink } from './ui/SkipLink'

interface EditorProps {
  /**
   * Document ouvert. Son contenu initialise l'éditeur au montage :
   * l'éditeur est remonté (clé) à chaque changement de document.
   */
  openedDocument: OpenedDocument
  /** Sauvegarde automatique du document : local ou cloud selon l'espace. */
  saver: DocumentSaver
  /** Espace cloud : l'état d'envoi est affiché dans la barre. */
  cloud: boolean
  /**
   * Renomme le document. false si le serveur ou le stockage a refusé.
   * Absent pour la base ou le corrigé d'un devoir : leur titre vient du devoir.
   */
  onRename?: (name: string) => Promise<boolean>
  onBackToDocuments: () => void
  /** Nature du contenu ouvert (ex. « Base du devoir »). */
  contentLabel?: string
  /** Libellé du bouton de retour (ex. « Retour au devoir »). */
  backLabel?: string
  /** Actions documents : absentes hors de l'espace documents. */
  onNewDocument?: () => void
  onImportFile?: (file: File) => Promise<string | null>
  /**
   * Consultation seule : le modèle s'affiche, se parcourt, se vérifie et
   * s'exporte, mais ne se modifie pas et rien n'est enregistré.
   */
  readOnly?: boolean
  /**
   * Co-édition : le document est partagé avec d'autres par son canal de
   * présence. Absent, l'éditeur ne se connecte à rien.
   */
  /**
   * Commentaires du travail. Absent : aucun fil, aucune bulle. Il ne
   * passe jamais par la barrière d'édition : en observation le modèle
   * est verrouillé, mais commenter reste le travail du prof.
   */
  comments?: CommentsAccess
  collaboration?: CollaborationInfo
  /**
   * Passer de l'observation à la correction à deux. Offert au prof dès
   * qu'il observe un travail suivi.
   */
  onStartCollaboration?: () => void
}

/** Consultation seule : aucune action n'atteint le modèle. */
const IGNORE_ACTION = () => {}

/**
 * L'éditeur Merise sur un document : MCD, dictionnaire, MLD, MPD, SQL,
 * Apprendre. Le MCD du document reste la source de vérité.
 */
export function Editor({
  openedDocument,
  saver,
  cloud,
  onRename,
  onBackToDocuments,
  contentLabel,
  backLabel,
  onNewDocument,
  onImportFile,
  readOnly = false,
  comments,
  collaboration,
  onStartCollaboration,
}: EditorProps) {
  /*
   * Qui ensemence le document Yjs. L'invité d'une co-édition et le
   * membre d'un groupe naissent vides et se remplissent par la
   * synchronisation : semer des deux côtés doublerait le modèle. Le
   * membre, lui, adopte ensuite le contenu du serveur si personne ne
   * l'a fait, voir `useSharedSeed`.
   */
  const role = collaboration?.role
  const guest = role === 'guest'
  const member = role === 'member'

  // Le modèle vit dans un document Yjs : c'est la source de vérité, et
  // le socle de l'édition à plusieurs. L'éditeur n'en voit qu'un état
  // JS ordinaire, exactement comme avant.
  const { state, dispatch: editAction, canUndo, canRedo, undo, redo, adopt, sync } = useModelDoc(
    openedDocument.state,
    { seed: !guest && !member },
  )
  // Modèle vide : c'est ce qui dit qu'un document de groupe attend
  // encore son contenu, et ce qui décide de la confirmation de fermeture.
  const modelIsEmpty =
    state.mcd.properties.length === 0 &&
    state.mcd.entities.length === 0 &&
    state.mcd.associations.length === 0
  const [selection, setSelection] = useState<CanvasSelection>(EMPTY_SELECTION)

  // Ma sélection part aux autres : des identifiants, rien du contenu.
  const sharedSelection = useMemo(
    () => [...selection.nodeIds, ...selection.edgeIds],
    [selection],
  )
  const collab = useCollaboration({
    sync,
    info: collaboration ?? null,
    selection: sharedSelection,
  })

  /**
   * L'invité n'écrit que tant que le lien tient : sans canal, ses
   * modifications n'arriveraient nulle part et personne ne les
   * enregistrerait. Le propriétaire, lui, édite toujours.
   */
  const linkLost = guest && collab.state !== 'live'
  const locked = readOnly || linkLost
  /*
   * Le crayon rouge n'existe qu'en correction à deux, et seulement pour
   * le prof. En observation, aucun canal de présence n'est ouvert : on
   * n'en ouvre pas pour dessiner, la discrétion de la lecture reste
   * entière. Lien perdu, le crayon se coupe comme l'écriture.
   */
  const canInk = collaboration?.role === 'guest' && collaboration.me.role === 'teacher' && !locked
  // Une seule barrière pour tout l'éditeur : l'inspecteur, le dictionnaire,
  // la barre d'outils et les étiquettes de pattes passent tous par là.
  const dispatch = locked ? IGNORE_ACTION : editAction
  // La vue active est un état d'interface, jamais une donnée du modèle.
  const [activeView, setActiveView] = useState<ViewId>('mcd')
  // Réglages MPD, seule partie éditable du MPD : dialecte + surcharges
  // de types par colonne. Sauvegardés avec le document.
  const [mpdSettings, setMpdSettings] = useState<MpdSettings>(openedDocument.mpdSettings)
  const [syncStatus, setSyncStatus] = useState<SaveStatus>(() => saver.getStatus())

  const problems = useMemo(() => validate(state.mcd), [state.mcd])
  const hasErrors = validationErrors(problems).length > 0

  // MLD, MPD et SQL dérivent toujours du MCD courant : dérivation pure,
  // recalculée à chaque changement, jamais un état à mémoriser.
  const mldTables = useMemo(() => mcdToMld(state.mcd), [state.mcd])
  const mpdTables = useMemo(() => buildMpd(mldTables, mpdSettings), [mldTables, mpdSettings])

  // Observation en direct : le modèle consulté change tout seul quand
  // son auteur travaille. On l'adopte sans remonter l'éditeur, pour
  // garder le cadrage, le zoom et la vue en cours. L'adoption passe par
  // editAction et non par la barrière : observer n'est pas modifier,
  // mais il faut bien que l'image suive.
  // On retient l'instantané déjà adopté : l'état du document Yjs n'est
  // jamais la même référence que celui reçu, il faut donc comparer à la
  // source, sinon l'effet se rappellerait sans fin.
  const adoptedRef = useRef(openedDocument.state)
  useEffect(() => {
    if (!readOnly || openedDocument.state === adoptedRef.current) {
      return
    }
    adoptedRef.current = openedDocument.state
    adopt(openedDocument.state)
  }, [readOnly, openedDocument.state, adopt])

  /*
   * Document d'un groupe : il naît vide et se remplit par la
   * synchronisation ou par l'adoption. Enregistrer avant que ce soit
   * tranché écraserait le travail du groupe par un modèle vide, donc on
   * attend. Hors groupe, `ready` est vrai d'emblée.
   */
  const { ready } = useSharedSeed({
    active: member,
    initial: openedDocument.state,
    empty: modelIsEmpty,
    state: collab.state,
    clientId: sync.awareness.clientID,
    peerIds: collab.others.map((other) => other.clientId),
    adopt,
  })

  // Sauvegarde automatique : le saver ignore les états identiques, donc
  // ouvrir un document sans y toucher ne modifie pas sa date.
  useEffect(() => {
    if (locked || !ready) {
      return
    }
    saver.save(state, mpdSettings)
  }, [state, mpdSettings, saver, locked, ready])

  useEffect(() => {
    setSyncStatus(saver.getStatus())
    return saver.subscribe(setSyncStatus)
  }, [saver])

  // Fermeture de la page avec un modèle non vide : confirmation native
  // du navigateur (imposée par la plateforme, pas de boîte personnalisée
  // possible ici). La sauvegarde automatique limite déjà la casse.
  useEffect(() => {
    if (modelIsEmpty || locked) {
      return
    }
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [modelIsEmpty, locked])

  // Ctrl+A dans la vue MCD : tout sélectionner (hors champs de saisie).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'a') {
        return
      }
      if (activeView !== 'mcd' || isEditableTarget(event.target)) {
        return
      }
      event.preventDefault()
      setSelection({
        nodeIds: new Set([
          ...state.mcd.entities.map((e) => e.id),
          ...state.mcd.associations.map((a) => a.id),
        ]),
        edgeIds: new Set(state.mcd.associations.flatMap((a) => a.legs.map((l) => l.id))),
      })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeView, state.mcd])

  // Annuler/rétablir au clavier, partout dans l'éditeur, sauf dans un
  // champ de saisie : la frappe s'y annule nativement.
  useEffect(() => {
    if (locked) {
      return
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if ((!event.ctrlKey && !event.metaKey) || isEditableTarget(event.target)) {
        return
      }
      const key = event.key.toLowerCase()
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault()
        undo()
      } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
        event.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [locked, undo, redo])

  // Générer : le MCD est vérifié par la barre d'outils, on ouvre le résultat.
  const handleGenerate = useCallback(() => {
    setActiveView('mld')
  }, [])

  const setDialect = useCallback((dialect: SqlDialect) => {
    setMpdSettings((previous) => ({ ...previous, dialect }))
  }, [])

  const setTypeOverride = useCallback((columnId: string, value: string) => {
    setMpdSettings((previous) => {
      const overrides = { ...previous.overrides }
      if (value.trim() === '') {
        delete overrides[columnId]
      } else {
        overrides[columnId] = value
      }
      return { ...previous, overrides }
    })
  }, [])

  // Clic sur un problème : sélectionne l'élément fautif dans le canvas.
  const selectElement = useCallback(
    (elementId: string) => {
      if (findEntity(state.mcd, elementId) || findAssociation(state.mcd, elementId)) {
        setSelection({ nodeIds: new Set([elementId]), edgeIds: new Set() })
      } else if (findLeg(state.mcd, elementId)) {
        setSelection({ nodeIds: new Set(), edgeIds: new Set([elementId]) })
      }
    },
    [state.mcd],
  )

  return (
    <div className="flex h-dvh flex-col bg-shell font-sans text-ink">
      <SkipLink />

      <ReactFlowProvider>
        <TopBar
          state={state}
          mpdSettings={mpdSettings}
          documentName={openedDocument.meta.name}
          onRename={onRename}
          onBackToDocuments={onBackToDocuments}
          contentLabel={contentLabel}
          backLabel={backLabel}
          onNewDocument={onNewDocument}
          onImportFile={onImportFile}
          syncStatus={syncStatus}
          onRetrySync={saver.retry}
          cloud={cloud}
          readOnly={locked}
          participants={collaboration ? collab.participants : undefined}
          mcdVisible={activeView === 'mcd'}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
        />

        <div className="flex min-h-0 flex-1">
          <NavRail activeView={activeView} onSelectView={setActiveView} />

          <main id="contenu" className="flex min-h-0 min-w-0 flex-1 flex-col">
            {activeView === 'dictionnaire' && (
              <DictionaryView mcd={state.mcd} dispatch={dispatch} readOnly={locked} />
            )}

            <McdView
              state={state}
              dispatch={dispatch}
              selection={selection}
              onSelectionChange={setSelection}
              problems={problems}
              onSelectElement={selectElement}
              onGenerate={handleGenerate}
              isActive={activeView === 'mcd'}
              others={collab.others}
              onPointerFlow={collaboration ? collab.reportCursor : undefined}
              onDraftLink={collaboration ? collab.reportDraftLink : undefined}
              comments={comments}
              onInkStroke={canInk ? collab.reportInk : undefined}
              // Entre pairs d'un groupe, personne n'est prof de personne.
              teacherTag={role !== 'member'}
              banner={
                collaboration || onStartCollaboration ? (
                  <CollaborationBanner
                    state={collab.state}
                    // Sans contexte collaboratif, on ne fait que lire : c'est
                    // l'observation d'un travail suivi, qui n'ouvre aucun canal.
                    mode={collaboration ? 'edit' : 'observe'}
                    participants={collab.participants}
                    others={collab.others}
                    role={role ?? 'owner'}
                    onStart={onStartCollaboration}
                  />
                ) : undefined
              }
              readOnly={locked}
            />

            {activeView === 'mld' && <MldView tables={mldTables} hasErrors={hasErrors} />}

            {/* Comme le MCD, le MPD reste monté quand il est masqué : les
                positions de son diagramme survivent au changement de vue. */}
            <MpdView
              tables={mpdTables}
              hasErrors={hasErrors}
              settings={mpdSettings}
              onDialectChange={setDialect}
              onOverrideChange={setTypeOverride}
              isActive={activeView === 'mpd'}
            />

            {activeView === 'sql' && (
              <SqlView tables={mpdTables} dialect={mpdSettings.dialect} hasErrors={hasErrors} />
            )}

            {activeView === 'code' && (
              <CodeView
                mcd={state.mcd}
                tables={mldTables}
                settings={mpdSettings}
                hasErrors={hasErrors}
              />
            )}

            {activeView === 'apprendre' && <LearnView onSelectView={setActiveView} />}
            {activeView === 'apropos' && <AboutView />}
          </main>
        </div>
      </ReactFlowProvider>
    </div>
  )
}
