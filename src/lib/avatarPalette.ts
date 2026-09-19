/**
 * Paires de couleurs prêtes pour la pastille d'initiales. Elles suivent
 * la palette du serveur (config/profile.php), que l'API n'expose pas.
 * Chaque paire porte un nom lisible, qui sert de libellé au choix.
 */

export interface AvatarPair {
  /** Nom lisible, annoncé aux lecteurs d'écran. */
  label: string
  background: string
  text: string
}

export const AVATAR_PALETTE: readonly AvatarPair[] = [
  { label: 'Parme', background: '#e0e7ff', text: '#1e1b4b' },
  { label: 'Rose', background: '#fee2e2', text: '#7f1d1d' },
  { label: 'Vert', background: '#dcfce7', text: '#14532d' },
  { label: 'Ambre', background: '#fef3c7', text: '#78350f' },
  { label: 'Ciel', background: '#e0f2fe', text: '#0c4a6e' },
  { label: 'Violet', background: '#f3e8ff', text: '#4c1d95' },
  { label: 'Framboise', background: '#ffe4e6', text: '#881337' },
  { label: 'Turquoise', background: '#ccfbf1', text: '#134e4a' },
  { label: 'Indigo', background: '#ede9fe', text: '#312e81' },
  { label: 'Orchidée', background: '#fae8ff', text: '#701a75' },
]
