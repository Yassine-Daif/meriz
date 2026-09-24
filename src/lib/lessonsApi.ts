import type { ApiClient, Outcome } from './apiClient'
import { unexpectedResponse } from './apiClient'
import { optionalText } from './authApi'

/**
 * Cours d'une classe : une page de blocs ordonnés, plus les images et
 * les pistes audio qu'elle utilise. Un cours n'arrive chez un élève que
 * s'il est publié : c'est le serveur qui en décide, jamais l'affichage.
 *
 * Le contenu de la page est une chaîne JSON que le serveur garde telle
 * quelle, sans jamais l'interpréter. Sa forme est décrite dans
 * lessonBlocks.ts, seul endroit qui la connaisse.
 */

export type LessonStatus = 'draft' | 'published'
export type MediumKind = 'image' | 'audio'

/** Fichier joint à un cours, servi par le serveur avec le jeton. */
export interface LessonMedium {
  id: string
  kind: MediumKind
  mime: string
  /** Taille en octets. */
  size: number
  /** Nom d'origine, nettoyé par le serveur. */
  name: string
  createdAt: string | null
}

/** Ligne de liste : ni la page de blocs, ni les médias. */
export interface LessonSummary {
  id: string
  classroomId: string
  title: string
  status: LessonStatus
  publishedAt: string | null
  /** Nombre de fichiers joints, utile avant même d'ouvrir le cours. */
  mediaCount: number
  createdAt: string | null
  updatedAt: string | null
}

/** Cours ouvert : sa page et ses fichiers. */
export interface Lesson extends LessonSummary {
  /** Page de blocs, en JSON. À lire avec parseBlocks. */
  blocks: string
  media: LessonMedium[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseLessonMedium(raw: unknown): LessonMedium | null {
  if (
    !isRecord(raw) ||
    typeof raw.id !== 'string' ||
    raw.id === '' ||
    (raw.kind !== 'image' && raw.kind !== 'audio') ||
    typeof raw.mime !== 'string' ||
    typeof raw.size !== 'number' ||
    typeof raw.name !== 'string'
  ) {
    return null
  }
  const createdAt = optionalText(raw.created_at)
  if (createdAt === undefined) {
    return null
  }
  return { id: raw.id, kind: raw.kind, mime: raw.mime, size: raw.size, name: raw.name, createdAt }
}

export function parseLessonSummary(raw: unknown): LessonSummary | null {
  if (
    !isRecord(raw) ||
    typeof raw.id !== 'string' ||
    raw.id === '' ||
    typeof raw.classroom_id !== 'string' ||
    typeof raw.title !== 'string' ||
    (raw.status !== 'draft' && raw.status !== 'published')
  ) {
    return null
  }
  const publishedAt = optionalText(raw.published_at)
  const createdAt = optionalText(raw.created_at)
  const updatedAt = optionalText(raw.updated_at)
  if (publishedAt === undefined || createdAt === undefined || updatedAt === undefined) {
    return null
  }
  if (raw.media_count !== undefined && typeof raw.media_count !== 'number') {
    return null
  }
  return {
    id: raw.id,
    classroomId: raw.classroom_id,
    title: raw.title,
    status: raw.status,
    publishedAt,
    mediaCount: typeof raw.media_count === 'number' ? raw.media_count : 0,
    createdAt,
    updatedAt,
  }
}

export function parseLesson(raw: unknown): Lesson | null {
  const summary = parseLessonSummary(raw)
  if (!summary || !isRecord(raw) || typeof raw.blocks !== 'string') {
    return null
  }
  const media: LessonMedium[] = []
  if (raw.media !== undefined) {
    if (!Array.isArray(raw.media)) {
      return null
    }
    for (const item of raw.media) {
      const medium = parseLessonMedium(item)
      if (!medium) {
        return null
      }
      media.push(medium)
    }
  }
  return { ...summary, blocks: raw.blocks, media }
}

function lessonPath(id: string, suffix = ''): string {
  return `/lessons/${encodeURIComponent(id)}${suffix}`
}

export function mediumPath(lessonId: string, mediumId: string): string {
  return lessonPath(lessonId, `/media/${encodeURIComponent(mediumId)}`)
}

/** Appel qui renvoie un cours complet. */
async function detailRequest(
  client: ApiClient,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<Outcome<Lesson>> {
  const result = await client.request(method, path, body)
  if (!result.ok) {
    return result
  }
  const lesson = parseLesson(result.data)
  return lesson ? { ok: true, value: lesson } : { ok: false, error: unexpectedResponse(result.status) }
}

export async function listClassroomLessons(
  client: ApiClient,
  classroomId: string,
): Promise<Outcome<LessonSummary[]>> {
  const result = await client.request('GET', `/classrooms/${encodeURIComponent(classroomId)}/lessons`)
  if (!result.ok) {
    return result
  }
  if (!Array.isArray(result.data)) {
    return { ok: false, error: unexpectedResponse(result.status) }
  }
  const lessons: LessonSummary[] = []
  for (const item of result.data) {
    const parsed = parseLessonSummary(item)
    if (!parsed) {
      return { ok: false, error: unexpectedResponse(result.status) }
    }
    lessons.push(parsed)
  }
  return { ok: true, value: lessons }
}

export function getLesson(client: ApiClient, id: string): Promise<Outcome<Lesson>> {
  return detailRequest(client, 'GET', lessonPath(id))
}

export function createLesson(
  client: ApiClient,
  classroomId: string,
  draft: { title: string; blocks: string },
): Promise<Outcome<Lesson>> {
  return detailRequest(client, 'POST', `/classrooms/${encodeURIComponent(classroomId)}/lessons`, {
    title: draft.title,
    blocks: draft.blocks,
  })
}

/** Modification partielle : seules les clés fournies partent au serveur. */
export function updateLesson(
  client: ApiClient,
  id: string,
  patch: { title?: string; blocks?: string },
): Promise<Outcome<Lesson>> {
  const body: Record<string, string> = {}
  if (patch.title !== undefined) body.title = patch.title
  if (patch.blocks !== undefined) body.blocks = patch.blocks
  return detailRequest(client, 'PATCH', lessonPath(id), body)
}

export async function deleteLesson(client: ApiClient, id: string): Promise<Outcome<void>> {
  const result = await client.request('DELETE', lessonPath(id))
  return result.ok ? { ok: true, value: undefined } : result
}

export function publishLesson(client: ApiClient, id: string): Promise<Outcome<Lesson>> {
  return detailRequest(client, 'POST', lessonPath(id, '/publication'))
}

export function unpublishLesson(client: ApiClient, id: string): Promise<Outcome<Lesson>> {
  return detailRequest(client, 'DELETE', lessonPath(id, '/publication'))
}

/** Envoi d'un fichier : multipart, champ « file », comme l'attend le serveur. */
export async function uploadLessonMedium(
  client: ApiClient,
  lessonId: string,
  file: File,
): Promise<Outcome<LessonMedium>> {
  const form = new FormData()
  form.append('file', file)
  const result = await client.request('POST', lessonPath(lessonId, '/media'), form)
  if (!result.ok) {
    return result
  }
  const medium = parseLessonMedium(result.data)
  return medium ? { ok: true, value: medium } : { ok: false, error: unexpectedResponse(result.status) }
}

export async function deleteLessonMedium(
  client: ApiClient,
  lessonId: string,
  mediumId: string,
): Promise<Outcome<void>> {
  const result = await client.request('DELETE', mediumPath(lessonId, mediumId))
  return result.ok ? { ok: true, value: undefined } : result
}

/** Les fichiers sont servis avec le jeton : une balise img ne peut pas les charger seule. */
export function fetchLessonMedium(
  client: ApiClient,
  lessonId: string,
  mediumId: string,
): Promise<Outcome<Blob>> {
  return client.requestBlob(mediumPath(lessonId, mediumId))
}

/* ------------------------------------------------------------------ */
/* Affichage                                                          */

const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' })

/** « Publié le 24 septembre 2026 », ou l'état de brouillon. */
export function lessonStateLabel(lesson: LessonSummary): string {
  if (lesson.status !== 'published') {
    return 'Brouillon'
  }
  if (lesson.publishedAt === null) {
    return 'Publié'
  }
  const date = new Date(lesson.publishedAt)
  return Number.isNaN(date.getTime()) ? 'Publié' : `Publié le ${dateFormat.format(date)}`
}

/** « 3 fichiers », au singulier ou au pluriel, ou une chaîne vide. */
export function mediaCountLabel(count: number): string {
  if (count <= 0) return ''
  return count === 1 ? '1 fichier' : `${count} fichiers`
}
