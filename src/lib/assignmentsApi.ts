import type { ApiClient, Outcome } from './apiClient'
import { unexpectedResponse } from './apiClient'
import { optionalText } from './authApi'
import { parseCloudDocument } from './documentsApi'
import type { CloudDocument } from './documentsApi'

/**
 * Devoirs d'une classe : exercices et examens donnés par le prof. Le
 * corrigé n'arrive chez un élève que si le devoir est publié et le
 * corrigé libéré : c'est le serveur qui en décide, jamais l'affichage.
 *
 * La base et le corrigé sont des modèles Meriz enregistrés tels quels,
 * au même format que le contenu d'un document (voir persistence.ts).
 */

export type AssignmentType = 'exercise' | 'exam'
export type AssignmentStatus = 'draft' | 'published'
export type AssignmentField = 'base' | 'solution'

/** Ligne de liste : ni consigne ni contenus. */
export interface AssignmentSummary {
  id: string
  classroomId: string
  title: string
  type: AssignmentType
  /** Date limite, en ISO. null quand il n'y en a pas. */
  dueAt: string | null
  status: AssignmentStatus
  publishedAt: string | null
  hasImage: boolean
  /** Adresse de l'image, servie par le serveur avec le jeton. */
  imageUrl: string | null
  hasBase: boolean
  /** Présence du corrigé : renvoyée au prof de la classe seulement. */
  hasSolution: boolean
  solutionReleased: boolean
  createdAt: string | null
  updatedAt: string | null
}

/** Devoir complet, tel que le serveur le renvoie au prof. */
export interface Assignment extends AssignmentSummary {
  instructions: string
  baseContent: string | null
  /** Corrigé : absent tant que le lecteur n'y a pas droit. */
  solutionContent: string | null
}

export interface AssignmentDraft {
  title: string
  instructions: string
  type: AssignmentType
  /** ISO, ou null pour retirer l'échéance. */
  dueAt?: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function optionalFlag(value: unknown): boolean {
  return value === true
}

export function parseAssignmentSummary(raw: unknown): AssignmentSummary | null {
  if (
    !isRecord(raw) ||
    typeof raw.id !== 'string' ||
    raw.id === '' ||
    typeof raw.classroom_id !== 'string' ||
    typeof raw.title !== 'string' ||
    (raw.type !== 'exercise' && raw.type !== 'exam') ||
    (raw.status !== 'draft' && raw.status !== 'published')
  ) {
    return null
  }
  const dueAt = optionalText(raw.due_at)
  const publishedAt = optionalText(raw.published_at)
  const imageUrl = optionalText(raw.image_url)
  const createdAt = optionalText(raw.created_at)
  const updatedAt = optionalText(raw.updated_at)
  if (
    dueAt === undefined ||
    publishedAt === undefined ||
    imageUrl === undefined ||
    createdAt === undefined ||
    updatedAt === undefined
  ) {
    return null
  }
  return {
    id: raw.id,
    classroomId: raw.classroom_id,
    title: raw.title,
    type: raw.type,
    dueAt,
    status: raw.status,
    publishedAt,
    hasImage: optionalFlag(raw.has_image),
    imageUrl,
    hasBase: optionalFlag(raw.has_base),
    hasSolution: optionalFlag(raw.has_solution),
    solutionReleased: optionalFlag(raw.solution_released),
    createdAt,
    updatedAt,
  }
}

export function parseAssignment(raw: unknown): Assignment | null {
  const summary = parseAssignmentSummary(raw)
  if (!summary || !isRecord(raw) || typeof raw.instructions !== 'string') {
    return null
  }
  const baseContent = optionalText(raw.base_content)
  const solutionContent = optionalText(raw.solution_content)
  if (baseContent === undefined || solutionContent === undefined) {
    return null
  }
  return { ...summary, instructions: raw.instructions, baseContent, solutionContent }
}

function assignmentPath(id: string, suffix = ''): string {
  return `/assignments/${encodeURIComponent(id)}${suffix}`
}

/** Appel qui renvoie un devoir complet. */
async function detailRequest(
  client: ApiClient,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<Outcome<Assignment>> {
  const result = await client.request(method, path, body)
  if (!result.ok) {
    return result
  }
  const assignment = parseAssignment(result.data)
  return assignment ? { ok: true, value: assignment } : { ok: false, error: unexpectedResponse(result.status) }
}

export async function listClassroomAssignments(
  client: ApiClient,
  classroomId: string,
): Promise<Outcome<AssignmentSummary[]>> {
  const result = await client.request('GET', `/classrooms/${encodeURIComponent(classroomId)}/assignments`)
  if (!result.ok) {
    return result
  }
  if (!Array.isArray(result.data)) {
    return { ok: false, error: unexpectedResponse(result.status) }
  }
  const assignments: AssignmentSummary[] = []
  for (const item of result.data) {
    const parsed = parseAssignmentSummary(item)
    if (!parsed) {
      return { ok: false, error: unexpectedResponse(result.status) }
    }
    assignments.push(parsed)
  }
  return { ok: true, value: assignments }
}

export function getAssignment(client: ApiClient, id: string): Promise<Outcome<Assignment>> {
  return detailRequest(client, 'GET', assignmentPath(id))
}

export function createAssignment(
  client: ApiClient,
  classroomId: string,
  draft: AssignmentDraft,
): Promise<Outcome<Assignment>> {
  return detailRequest(client, 'POST', `/classrooms/${encodeURIComponent(classroomId)}/assignments`, {
    title: draft.title,
    instructions: draft.instructions,
    type: draft.type,
    due_at: draft.dueAt ?? null,
  })
}

/** Modification partielle : seules les clés fournies partent au serveur. */
export function updateAssignment(
  client: ApiClient,
  id: string,
  patch: Partial<AssignmentDraft> & { baseContent?: string | null; solutionContent?: string | null },
): Promise<Outcome<Assignment>> {
  const body: Record<string, unknown> = {}
  if (patch.title !== undefined) body.title = patch.title
  if (patch.instructions !== undefined) body.instructions = patch.instructions
  if (patch.type !== undefined) body.type = patch.type
  if (patch.dueAt !== undefined) body.due_at = patch.dueAt
  if (patch.baseContent !== undefined) body.base_content = patch.baseContent
  if (patch.solutionContent !== undefined) body.solution_content = patch.solutionContent
  return detailRequest(client, 'PATCH', assignmentPath(id), body)
}

export async function deleteAssignment(client: ApiClient, id: string): Promise<Outcome<void>> {
  const result = await client.request('DELETE', assignmentPath(id))
  return result.ok ? { ok: true, value: undefined } : result
}

export function publishAssignment(client: ApiClient, id: string): Promise<Outcome<Assignment>> {
  return detailRequest(client, 'POST', assignmentPath(id, '/publication'))
}

export function unpublishAssignment(client: ApiClient, id: string): Promise<Outcome<Assignment>> {
  return detailRequest(client, 'DELETE', assignmentPath(id, '/publication'))
}

export function releaseSolution(client: ApiClient, id: string): Promise<Outcome<Assignment>> {
  return detailRequest(client, 'POST', assignmentPath(id, '/solution-release'))
}

export function withholdSolution(client: ApiClient, id: string): Promise<Outcome<Assignment>> {
  return detailRequest(client, 'DELETE', assignmentPath(id, '/solution-release'))
}

/** Envoi de l'image : multipart, champ « image », comme l'attend le serveur. */
export function uploadAssignmentImage(client: ApiClient, id: string, file: File): Promise<Outcome<Assignment>> {
  const form = new FormData()
  form.append('image', file)
  return detailRequest(client, 'POST', assignmentPath(id, '/image'), form)
}

export function removeAssignmentImage(client: ApiClient, id: string): Promise<Outcome<Assignment>> {
  return detailRequest(client, 'DELETE', assignmentPath(id, '/image'))
}

/** L'image est servie avec le jeton : une balise img ne peut pas la charger seule. */
export function fetchAssignmentImage(client: ApiClient, id: string): Promise<Outcome<Blob>> {
  return client.requestBlob(assignmentPath(id, '/image'))
}

/**
 * Copie la base du devoir dans un document personnel : c'est le point de
 * départ du travail de l'élève. Le corrigé n'est jamais copié. Sans base,
 * le serveur refuse sur le champ base_content.
 */
export async function copyAssignmentBase(client: ApiClient, id: string): Promise<Outcome<CloudDocument>> {
  const result = await client.request('POST', assignmentPath(id, '/copy'))
  if (!result.ok) {
    return result
  }
  const document = parseCloudDocument(result.data)
  return document ? { ok: true, value: document } : { ok: false, error: unexpectedResponse(result.status) }
}

/* ------------------------------------------------------------------ */
/* Affichage                                                          */

export function assignmentTypeLabel(type: AssignmentType): string {
  return type === 'exam' ? 'Examen' : 'Exercice'
}

const dueFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' })

/** « 1 octobre 2026 à 18:00 », ou un repli si la date est illisible. */
export function formatDueDate(iso: string | null): string {
  if (iso === null) return 'Sans échéance'
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? 'Échéance inconnue' : `À rendre le ${dueFormat.format(date)}`
}

/**
 * Champ natif datetime-local : « 2026-10-01T18:00 », dans le fuseau du
 * navigateur. Vide quand il n'y a pas d'échéance.
 */
export function toLocalInput(iso: string | null): string {
  if (iso === null) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Retour vers l'ISO envoyé au serveur. Une saisie vide vaut « sans échéance ». */
export function fromLocalInput(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const date = new Date(trimmed)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
