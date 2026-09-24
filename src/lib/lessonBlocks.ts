/**
 * Page d'un cours : une suite ordonnée de blocs. Le serveur garde cette
 * page en JSON sans jamais l'interpréter, donc ce fichier est le seul
 * endroit qui connaisse la forme des blocs.
 *
 * Le JSON enregistré reste en snake_case, comme le reste de l'API
 * (« media_id »), et le modèle de travail en camelCase.
 */

export type BlockType = 'heading' | 'text' | 'link' | 'video' | 'image' | 'audio'

export const BLOCK_TYPES: readonly BlockType[] = ['heading', 'text', 'link', 'video', 'image', 'audio']

export type LessonBlock =
  /** Titre de section. */
  | { type: 'heading'; text: string }
  /** Texte, sur plusieurs lignes. */
  | { type: 'text'; text: string }
  | { type: 'link'; url: string; label: string }
  /** Vidéo chez un hébergeur : jamais un fichier envoyé (voir videoEmbed.ts). */
  | { type: 'video'; url: string }
  /** Image envoyée, avec sa description pour l'accessibilité. */
  | { type: 'image'; mediaId: string; alt: string }
  /** Piste audio envoyée ou enregistrée, avec son libellé. */
  | { type: 'audio'; mediaId: string; label: string }

export function blockLabel(type: BlockType): string {
  switch (type) {
    case 'heading':
      return 'Titre de section'
    case 'text':
      return 'Texte'
    case 'link':
      return 'Lien'
    case 'video':
      return 'Vidéo'
    case 'image':
      return 'Image'
    case 'audio':
      return 'Audio'
  }
}

/** Bloc neuf, vide, du type demandé. */
export function emptyBlock(type: BlockType): LessonBlock {
  switch (type) {
    case 'heading':
      return { type: 'heading', text: '' }
    case 'text':
      return { type: 'text', text: '' }
    case 'link':
      return { type: 'link', url: '', label: '' }
    case 'video':
      return { type: 'video', url: '' }
    case 'image':
      return { type: 'image', mediaId: '', alt: '' }
    case 'audio':
      return { type: 'audio', mediaId: '', label: '' }
  }
}

/** Un bloc média sans fichier : le prof n'a pas encore envoyé le sien. */
export function mediaIdOf(block: LessonBlock): string | null {
  if (block.type === 'image' || block.type === 'audio') {
    return block.mediaId === '' ? null : block.mediaId
  }
  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function parseBlock(raw: unknown): LessonBlock | null {
  if (!isRecord(raw) || typeof raw.type !== 'string') {
    return null
  }
  switch (raw.type) {
    case 'heading':
      return { type: 'heading', text: text(raw.text) }
    case 'text':
      return { type: 'text', text: text(raw.text) }
    case 'link':
      return { type: 'link', url: text(raw.url), label: text(raw.label) }
    case 'video':
      return { type: 'video', url: text(raw.url) }
    case 'image':
      return { type: 'image', mediaId: text(raw.media_id), alt: text(raw.alt) }
    case 'audio':
      return { type: 'audio', mediaId: text(raw.media_id), label: text(raw.label) }
    default:
      return null
  }
}

/**
 * Lit la page enregistrée. Un contenu illisible ou d'un type inconnu
 * est ignoré : la page s'affiche quand même, sans jamais lever.
 */
export function parseBlocks(json: string): LessonBlock[] {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return []
  }
  if (!Array.isArray(raw)) {
    return []
  }
  const blocks: LessonBlock[] = []
  for (const item of raw) {
    const block = parseBlock(item)
    if (block) {
      blocks.push(block)
    }
  }
  return blocks
}

function toRaw(block: LessonBlock): Record<string, string> {
  switch (block.type) {
    case 'heading':
    case 'text':
      return { type: block.type, text: block.text }
    case 'link':
      return { type: 'link', url: block.url, label: block.label }
    case 'video':
      return { type: 'video', url: block.url }
    case 'image':
      return { type: 'image', media_id: block.mediaId, alt: block.alt }
    case 'audio':
      return { type: 'audio', media_id: block.mediaId, label: block.label }
  }
}

export function serializeBlocks(blocks: readonly LessonBlock[]): string {
  return JSON.stringify(blocks.map(toRaw))
}

/**
 * Déplace un bloc d'un rang. Aux extrémités, la page revient inchangée :
 * l'appelant sait ainsi que rien n'a bougé.
 *
 * Générique : l'éditeur manipule des blocs accompagnés d'un identifiant
 * d'édition, et réutilise la même règle d'ordre.
 */
export function moveBlock<T>(blocks: readonly T[], index: number, direction: 'up' | 'down'): T[] {
  const target = direction === 'up' ? index - 1 : index + 1
  if (index < 0 || index >= blocks.length || target < 0 || target >= blocks.length) {
    return [...blocks]
  }
  const next = [...blocks]
  const moved = next[index]
  const swapped = next[target]
  if (moved === undefined || swapped === undefined) {
    return next
  }
  next[index] = swapped
  next[target] = moved
  return next
}

export function removeBlock<T>(blocks: readonly T[], index: number): T[] {
  return blocks.filter((_, position) => position !== index)
}

export function replaceBlock<T>(blocks: readonly T[], index: number, block: T): T[] {
  return blocks.map((current, position) => (position === index ? block : current))
}
