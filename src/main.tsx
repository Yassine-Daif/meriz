import { StrictMode } from 'react'
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SessionProvider>
      <App />
    </SessionProvider>
  </StrictMode>,
)
