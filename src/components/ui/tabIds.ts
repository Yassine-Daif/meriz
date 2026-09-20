/**
 * Identifiants liant un onglet à son panneau (aria-controls et
 * aria-labelledby). Dans un fichier à part : le rafraîchissement à
 * chaud de React n'aime pas les exports qui ne sont pas des composants.
 */
export function tabId(base: string, value: string): string {
  return `${base}-onglet-${value}`
}

export function panelId(base: string, value: string): string {
  return `${base}-panneau-${value}`
}