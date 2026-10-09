import type { ApiClient, Outcome } from './apiClient'
import { unexpectedResponse } from './apiClient'
import { parsePublicProfile } from './classroomsApi'
import type { PublicProfile } from './classroomsApi'

/**
 * Commentaires d'un travail : le fil de la correction, dans les deux sens.
 *
 * Un commentaire se rattache au document de travail, jamais au devoir ni
 * au rendu. Le fil est plat, sans réponses imbriquées, et le corps d'un
 * commentaire ne se modifie pas : seul son état résolu change.
 */

/** Point d'ancrage d'une bulle, en coordonnées du modèle. */
export interface CommentPosition {
  x: number
  y: number
}

export interface Comment {
  id: string
  documentId: string
  body: string
  /** Bulle posée sur le schéma, ou null pour un commentaire général. */
  position: CommentPosition | null
  resolved: boolean
  resolvedAt: string | null
  /**
   * Qui a résolu. Null aussi quand le compte a disparu : un commentaire
   * peut donc être résolu sans résolveur, ce n'est pas une anomalie.
   */
  resolver: PublicProfile | null
  author: PublicProfile
  createdAt: string | null
  updatedAt: string | null
}

/** Ce qu'on envoie pour écrire. Position nulle : commentaire général. */
export interface CommentDraft {
  body: string
  position: CommentPosition | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function optionalIso(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null
  return typeof value === 'string' ? value : undefined
}

/**
 * Trois états, comme `optionalText` : une position, rien du tout, ou
 * illisible. Une demi-position est illisible : le serveur exige les deux
 * coordonnées ou aucune.
 */
function parsePosition(raw: unknown): CommentPosition | null | undefined {
  if (raw === undefined || raw === null) {
    return null
  }
  if (!isRecord(raw) || !Number.isFinite(raw.x) || !Number.isFinite(raw.y)) {
    return undefined
  }
  return { x: raw.x as number, y: raw.y as number }
}

export function parseComment(raw: unknown): Comment | null {
  if (
    !isRecord(raw) ||
    typeof raw.id !== 'string' ||
    raw.id === '' ||
    typeof raw.document_id !== 'string' ||
    typeof raw.body !== 'string'
  ) {
    return null
  }
  const position = parsePosition(raw.position)
  const createdAt = optionalIso(raw.created_at)
  const updatedAt = optionalIso(raw.updated_at)
  const resolvedAt = optionalIso(raw.resolved_at)
  if (position === undefined || createdAt === undefined || updatedAt === undefined || resolvedAt === undefined) {
    return null
  }
  const author = parsePublicProfile(raw.author)
  if (author === null) {
    return null
  }
  // Un résolveur mal formé invalide la ligne, mais son absence est normale.
  const resolver =
    raw.resolver === undefined || raw.resolver === null ? null : parsePublicProfile(raw.resolver)
  if (resolver === null && raw.resolver !== undefined && raw.resolver !== null) {
    return null
  }
  return {
    id: raw.id,
    documentId: raw.document_id,
    body: raw.body,
    position,
    resolved: raw.resolved === true,
    resolvedAt,
    resolver,
    author,
    createdAt,
    updatedAt,
  }
}

function documentPath(id: string): string {
  return `/documents/${encodeURIComponent(id)}/comments`
}

function commentPath(id: string, suffix = ''): string {
  return `/comments/${encodeURIComponent(id)}${suffix}`
}

/** Appel qui renvoie un commentaire à jour. */
async function detailRequest(
  client: ApiClient,
  method: 'POST' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<Outcome<Comment>> {
  const result = await client.request(method, path, body)
  if (!result.ok) {
    return result
  }
  const comment = parseComment(result.data)
  return comment ? { ok: true, value: comment } : { ok: false, error: unexpectedResponse(result.status) }
}

/**
 * Le fil d'un travail, du plus ancien au plus récent. Le serveur trie
 * déjà. Une ligne illisible invalide toute la liste : on ne dessine pas
 * un fil troué.
 */
export async function listComments(client: ApiClient, documentId: string): Promise<Outcome<Comment[]>> {
  const result = await client.request('GET', documentPath(documentId))
  if (!result.ok) {
    return result
  }
  if (!Array.isArray(result.data)) {
    return { ok: false, error: unexpectedResponse(result.status) }
  }
  const comments: Comment[] = []
  for (const raw of result.data) {
    const comment = parseComment(raw)
    if (!comment) {
      return { ok: false, error: unexpectedResponse(result.status) }
    }
    comments.push(comment)
  }
  return { ok: true, value: comments }
}

/**
 * Écrit un commentaire.
 *
 * Attention à l'asymétrie du serveur : la réponse porte `position` en
 * objet, la requête attend deux champs plats. Et jamais une seule des
 * deux coordonnées, le serveur refuserait une moitié de couple.
 */
export async function createComment(
  client: ApiClient,
  documentId: string,
  draft: CommentDraft,
): Promise<Outcome<Comment>> {
  const payload =
    draft.position === null
      ? { body: draft.body }
      : { body: draft.body, position_x: draft.position.x, position_y: draft.position.y }
  const result = await client.request('POST', documentPath(documentId), payload)
  if (!result.ok) {
    // Le quota arrive en erreur de champ sur « body », le refus en 403
    // garde la phrase du serveur : rien à retraduire ici.
    return result
  }
  const comment = parseComment(result.data)
  return comment ? { ok: true, value: comment } : { ok: false, error: unexpectedResponse(result.status) }
}

export function resolveComment(client: ApiClient, commentId: string): Promise<Outcome<Comment>> {
  return detailRequest(client, 'POST', commentPath(commentId, '/resolution'))
}

/** Rouvrir efface la trace du résolveur : le serveur ne la garde pas. */
export function reopenComment(client: ApiClient, commentId: string): Promise<Outcome<Comment>> {
  return detailRequest(client, 'DELETE', commentPath(commentId, '/resolution'))
}

export async function deleteComment(client: ApiClient, commentId: string): Promise<Outcome<void>> {
  const result = await client.request('DELETE', commentPath(commentId))
  return result.ok ? { ok: true, value: undefined } : result
}

/* ------------------------------ Affichage ------------------------------ */

/** Du plus ancien au plus récent. À dates égales, l'ordre reçu est gardé. */
export function sortedThread(comments: Comment[]): Comment[] {
  return [...comments].sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))
}

/** Ce qui reste à traiter, bulles et commentaires généraux mêlés. */
export function unresolvedCount(comments: Comment[]): number {
  return comments.filter((comment) => !comment.resolved).length
}

/** Ceux qui portent une bulle, donc dessinables sur le schéma. */
export function pinnedComments(comments: Comment[]): Comment[] {
  return comments.filter((comment) => comment.position !== null)
}

export function commentCountLabel(count: number): string {
  if (count === 0) return 'Aucun commentaire'
  return count === 1 ? '1 commentaire' : `${count} commentaires`
}

export function formatCommentDate(iso: string | null): string {
  if (iso === null) return 'date inconnue'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'date inconnue'
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' }).format(date)
}

/** Nom lisible d'une personne, sans dépendre de l'ordre des champs. */
function personName(person: PublicProfile): string {
  return [person.firstName, person.name].filter((part) => part && part.trim() !== '').join(' ')
}

/** Étiquette d'une bulle, pour un lecteur d'écran : le texte porte l'état. */
export function pinLabel(comment: Comment, index: number): string {
  const extract = comment.body.length > 60 ? `${comment.body.slice(0, 60)}…` : comment.body
  const state = comment.resolved ? ', résolu' : ''
  return `Commentaire ${index + 1} de ${personName(comment.author)}${state} : « ${extract} »`
}

/**
 * Qui peut supprimer : l'auteur, ou le responsable du travail. C'est le
 * serveur qui décide, ceci ne fait qu'éviter d'offrir un bouton qui
 * recevrait un refus.
 */
export function canDeleteComment(comment: Comment, meId: number, canModerate: boolean): boolean {
  return comment.author.id === meId || canModerate
}
