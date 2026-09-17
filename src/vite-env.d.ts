/// <reference types="vite/client" />

// Variables d'environnement du projet. VITE_API_URL : origine du
// serveur Meriz API (sans /api), lue uniquement par src/lib/apiConfig.ts.
interface ImportMetaEnv {
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
