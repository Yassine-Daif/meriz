import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import type { OpenedDocument } from '../model/document'
import { createHistory, historyReducer } from '../model/historyReducer'
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
}

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
}: EditorProps) {
  const [history, dispatch] = useReducer(historyReducer, openedDocument.state, createHistory)
  const state = history.present
  const [selection, setSelection] = useState<CanvasSelection>(EMPTY_SELECTION)
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

  // Sauvegarde automatique : le saver ignore les états identiques, donc
  // ouvrir un document sans y toucher ne modifie pas sa date.
  useEffect(() => {
    saver.save(state, mpdSettings)
  }, [state, mpdSettings, saver])

  useEffect(() => {
    setSyncStatus(saver.getStatus())
    return saver.subscribe(setSyncStatus)
  }, [saver])

  // Fermeture de la page avec un modèle non vide : confirmation native
  // du navigateur (imposée par la plateforme, pas de boîte personnalisée
  // possible ici). La sauvegarde automatique limite déjà la casse.
  const modelIsEmpty =
    state.mcd.properties.length === 0 &&
    state.mcd.entities.length === 0 &&
    state.mcd.associations.length === 0
  useEffect(() => {
    if (modelIsEmpty) {
      return
    }
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [modelIsEmpty])

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
    const onKeyDown = (event: KeyboardEvent) => {
      if ((!event.ctrlKey && !event.metaKey) || isEditableTarget(event.target)) {
        return
      }
      const key = event.key.toLowerCase()
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault()
        dispatch({ type: 'UNDO' })
      } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
        event.preventDefault()
        dispatch({ type: 'REDO' })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

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
          mcdVisible={activeView === 'mcd'}
          canUndo={history.past.length > 0}
          canRedo={history.future.length > 0}
          onUndo={() => dispatch({ type: 'UNDO' })}
          onRedo={() => dispatch({ type: 'REDO' })}
        />

        <div className="flex min-h-0 flex-1">
          <NavRail activeView={activeView} onSelectView={setActiveView} />

          <main id="contenu" className="flex min-h-0 min-w-0 flex-1 flex-col">
            {activeView === 'dictionnaire' && (
              <DictionaryView mcd={state.mcd} dispatch={dispatch} />
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

            {activeView === 'apprendre' && <LearnView onSelectView={setActiveView} />}
            {activeView === 'apropos' && <AboutView />}
          </main>
        </div>
      </ReactFlowProvider>
    </div>
  )
}
