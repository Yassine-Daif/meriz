/**
 * Adresse du serveur Meriz, lue dans la variable d'environnement
 * VITE_API_URL (origine du serveur, sans /api). Jamais écrite en dur :
 * on passe du serveur local au serveur en ligne sans toucher au code.
 */

/** Origine http(s) valide, sans barre finale, sinon null. */
export function normalizeApiUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return null
  }
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return null
  }
  return url.href.replace(/\/+$/, '')
}

let warned = false

/**
 * Adresse configurée, ou null. Sans adresse, les comptes sont
 * indisponibles mais l'application locale fonctionne normalement.
 */
export function getApiBaseUrl(): string | null {
  const url = normalizeApiUrl(import.meta.env.VITE_API_URL)
  if (url === null && !warned) {
    warned = true
    console.warn(
      'Meriz : VITE_API_URL absente ou invalide, les comptes sont désactivés. Voir .env.example.',
    )
  }
  return url
}
