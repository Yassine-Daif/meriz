import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import type { McdEditorState } from './model/mcdReducer'
import { createHistory, historyReducer } from './model/historyReducer'
import { validate, validationErrors } from './model/validate'
import { mcdToMld } from './model/mld'
import { buildMpd, DEFAULT_MPD_SETTINGS } from './model/mpd'
import type { MpdSettings, SqlDialect } from './model/mpd'
import { findAssociation, findEntity, findLeg } from './model/queries'
import { loadAutosave, loadLegacyMpdSettings, saveAutosave } from './lib/persistence'
import { isEditableTarget } from './lib/keyboard'
import { EMPTY_SELECTION } from './canvas/selection'
import type { CanvasSelection } from './canvas/selection'
import type { ViewId } from './components/views'
import { TopBar } from './components/TopBar'
import { NavRail } from './components/NavRail'
import { HomeView } from './components/HomeView'
import { McdView } from './components/McdView'
import { DictionaryView } from './components/DictionaryView'
import { MldView } from './components/MldView'
import { MpdView } from './components/MpdView'
import { SqlView } from './components/SqlView'
import { LearnView } from './components/LearnView'
import { AboutView } from './components/AboutView'

// On démarre sur un modèle vide : rien par défaut, l'accueil guide.
const initialState: McdEditorState = {
  mcd: { properties: [], entities: [], associations: [] },
  layout: {},
}

// Lue une seule fois au chargement du module, pour le modèle et les réglages MPD.
const autosave = loadAutosave()

export function App() {
  const [history, dispatch] = useReducer(historyReducer, null, () =>
    createHistory(autosave?.state ?? initialState),
  )
  const state = history.present
  const [selection, setSelection] = useState<CanvasSelection>(EMPTY_SELECTION)
  // La vue active est un état d'interface, jamais une donnée du modèle.
  const [activeView, setActiveView] = useState<ViewId>('accueil')
  // Réglages MPD, seule partie éditable du MPD : dialecte + surcharges
  // de types par colonne. Sauvegardés avec le modèle.
  const [mpdSettings, setMpdSettings] = useState<MpdSettings>(
    () => autosave?.mpdSettings ?? loadLegacyMpdSettings() ?? DEFAULT_MPD_SETTINGS,
  )

  const problems = useMemo(() => validate(state.mcd), [state.mcd])
  const hasErrors = validationErrors(problems).length > 0

  // MLD, MPD et SQL dérivent toujours du MCD courant : dérivation pure,
  // recalculée à chaque changement, jamais un état à mémoriser.
  const mldTables = useMemo(() => mcdToMld(state.mcd), [state.mcd])
  const mpdTables = useMemo(() => buildMpd(mldTables, mpdSettings), [mldTables, mpdSettings])

  // Sauvegarde automatique locale : modèle, positions et réglages MPD.
  useEffect(() => {
    saveAutosave(state, mpdSettings)
  }, [state, mpdSettings])

  // Fermeture de la page avec un modèle non vide : confirmation native
  // du navigateur (imposée par la plateforme, pas de boîte personnalisée
  // possible ici). L'autosauvegarde limite déjà la casse.
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

  // Annuler/rétablir au clavier, partout dans l'application, sauf dans
  // un champ de saisie : la frappe s'y annule nativement.
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

  // Après Nouveau ou Ouvrir : la sélection ne référence plus rien.
  const clearSelection = useCallback(() => setSelection(EMPTY_SELECTION), [])

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
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10 focus:rounded focus:bg-indigo-700 focus:px-3 focus:py-2 focus:text-white"
      >
        Aller au contenu
      </a>

      <ReactFlowProvider>
        <TopBar
          state={state}
          dispatch={dispatch}
          onModelReplaced={clearSelection}
          mpdSettings={mpdSettings}
          onMpdSettingsReplaced={setMpdSettings}
          mcdVisible={activeView === 'mcd'}
          canUndo={history.past.length > 0}
          canRedo={history.future.length > 0}
          onUndo={() => dispatch({ type: 'UNDO' })}
          onRedo={() => dispatch({ type: 'REDO' })}
        />

        <div className="flex min-h-0 flex-1">
          <NavRail activeView={activeView} onSelectView={setActiveView} />

          <main id="contenu" className="flex min-h-0 min-w-0 flex-1 flex-col">
            {activeView === 'accueil' && <HomeView onSelectView={setActiveView} />}

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
