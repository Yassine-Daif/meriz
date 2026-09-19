/**
 * Couleurs venant des données, pas du thème : les deux couleurs de la
 * pastille d'avatar. Le serveur renvoie toujours un hexadécimal en
 * minuscules ; on reste tolérant à la lecture et strict à l'envoi.
 */

/** Mêmes valeurs par défaut que le serveur (config/profile.php). */
export const DEFAULT_AVATAR_BG = '#e0e7ff'
export const DEFAULT_AVATAR_FG = '#1e1b4b'

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

/**
 * « #ABC » et « #aabbcc » donnent « #aabbcc ». Tout le reste donne null.
 * Même forme que la normalisation du serveur.
 */
export function normalizeHex(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().toLowerCase()
  if (!HEX.test(trimmed)) return null
  if (trimmed.length === 7) return trimmed
  const [, r = '', g = '', b = ''] = trimmed
  return `#${r}${r}${g}${g}${b}${b}`
}

/**
 * Couleur d'avatar lue dans une réponse : une couleur illisible ou
 * absente ne fait jamais échouer la lecture d'une personne, elle
 * retombe sur la valeur par défaut.
 */
export function parseAvatarColor(raw: unknown, fallback: string): string {
  return normalizeHex(raw) ?? fallback
}

/** Luminance relative WCAG d'une couleur hexadécimale. */
export function relativeLuminance(hex: string): number {
  const normalized = normalizeHex(hex) ?? '#000000'
  const channels = (normalized.slice(1).match(/../g) ?? []).map((pair) => parseInt(pair, 16) / 255)
  const [r = 0, g = 0, b = 0] = channels.map((value) =>
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  )
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Rapport de contraste WCAG entre deux couleurs, de 1 à 21. */
export function contrastRatio(a: string, b: string): number {
  const [high, low] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [number, number]
  return (high + 0.05) / (low + 0.05)
}

/** Seuil de lisibilité du texte, niveau WCAG AA. */
export const READABLE_CONTRAST = 4.5

/** « 12,1 sur 1 », pour l'afficher en toutes lettres. */
export function formatContrast(ratio: number): string {
  return `${ratio.toFixed(1).replace('.', ',')} sur 1`
}
