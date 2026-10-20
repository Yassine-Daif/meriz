import { DesktopUpdates } from './components/DesktopUpdates'
import { StrictMode } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import { StartupUpdate } from './components/StartupUpdate'
import { updateBeforeStartup } from './lib/desktopUpdate'
import { createRoot } from 'react-dom/client'
/*
 * La feuille de React Flow reste au premier chargement, et c'est voulu.
 * Servie avec le chunk de l'éditeur, elle arrivait après index.css et
 * reprenait la main, à spécificité égale, sur la règle qui rend le focus
 * clavier visible dans le schéma. Trois kilos ne valent pas ce défaut.
 */
import '@xyflow/react/dist/style.css'
import './index.css'
import { App } from './App.tsx'
import { SessionProvider } from './components/SessionProvider.tsx'

const root = createRoot(document.getElementById('root')!)

function renderApplication() {
  root.render(
    <StrictMode>
      <SessionProvider>
        <DesktopUpdates><App /></DesktopUpdates>
      </SessionProvider>
    </StrictMode>,
  )
}

if (isTauri()) {
  // Avant React StrictMode : un seul contrôle et une seule installation.
  void (async () => {
    try {
      const [{ check }, { relaunch }] = await Promise.all([
        import('@tauri-apps/plugin-updater'), import('@tauri-apps/plugin-process'),
      ])
      await updateBeforeStartup(
        { check: () => check({ timeout: 10_000 }), relaunch },
        (state) => root.render(<StartupUpdate state={state} />),
      )
    } catch {
      // Le démarrage reste possible si le système de mise à jour est indisponible.
    } finally {
      renderApplication()
    }
  })()
} else {
  renderApplication()
}
