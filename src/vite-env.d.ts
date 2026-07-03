/// <reference types="vite/client" />

// Variables d'environnement du projet. VITE_API_URL est réservée au
// futur serveur d'API : personne ne la lit encore, l'app est statique.
interface ImportMetaEnv {
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
