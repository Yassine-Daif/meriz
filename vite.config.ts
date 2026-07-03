import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Chemins d'assets relatifs : le même build marche à la racine d'un
  // domaine, dans un sous-dossier (public_html/meriz) et dans Tauri.
  base: './',
  plugins: [react(), tailwindcss()],
  server: {
    watch: {
      // Le dossier Tauri (build Rust) ne doit pas déclencher de
      // rechargements du serveur de dev.
      ignored: ['**/src-tauri/**'],
    },
  },
})
