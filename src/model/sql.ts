/**
 * Utilitaires SQL partagés. La génération du script vit dans mpd.ts
 * (dérivation pure du MPD) ; ici, seulement l'assainissement des noms.
 */

/** Nom SQL sûr : accents retirés, espaces et signes remplacés par _. */
export function sanitizeSqlName(name: string): string {
  const cleaned = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9_]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
  return cleaned === '' ? 'sans_nom' : cleaned
}
