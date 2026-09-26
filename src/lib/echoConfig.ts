/**
 * Réglages du direct (websocket Reverb), lus dans les variables
 * d'environnement, jamais écrits en dur. Sans eux, pas de direct :
 * l'observation garde son rafraîchissement régulier, et personne ne
 * voit la différence.
 */

export interface EchoConfig {
  /** Clé publique de l'application Reverb. Elle circule côté navigateur. */
  key: string
  host: string
  port: number
  scheme: 'http' | 'https'
}

/** Réglages bruts, tels qu'ils arrivent de l'environnement. */
export interface RawEchoConfig {
  key?: string
  host?: string
  port?: string
  scheme?: string
}

/** Réglages complets et cohérents, sinon null. Un réglage à moitié rempli ne vaut rien. */
export function normalizeEchoConfig(raw: RawEchoConfig): EchoConfig | null {
  const key = typeof raw.key === 'string' ? raw.key.trim() : ''
  const host = typeof raw.host === 'string' ? raw.host.trim() : ''
  if (key === '' || host === '') {
    return null
  }
  const scheme = typeof raw.scheme === 'string' ? raw.scheme.trim().toLowerCase() : 'https'
  if (scheme !== 'http' && scheme !== 'https') {
    return null
  }
  const port = raw.port === undefined || raw.port.trim() === '' ? (scheme === 'https' ? 443 : 80) : Number(raw.port)
  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    return null
  }
  return { key, host, port, scheme }
}

/** Réglages du direct pour cette application, ou null. */
export function getEchoConfig(): EchoConfig | null {
  return normalizeEchoConfig({
    key: import.meta.env.VITE_REVERB_APP_KEY,
    host: import.meta.env.VITE_REVERB_HOST,
    port: import.meta.env.VITE_REVERB_PORT,
    scheme: import.meta.env.VITE_REVERB_SCHEME,
  })
}
