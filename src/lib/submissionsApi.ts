import type { ApiClient, Outcome } from './apiClient'
import { unexpectedResponse } from './apiClient'
import { optionalText } from './authApi'
import { parsePublicProfile } from './classroomsApi'
import type { PublicProfile } from './classroomsApi'

/**
 * Rendus d'un devoir : un seul par élève, déposé puis modifiable tant
 * que le prof ne l'a pas noté. Une fois noté, le serveur le verrouille ;
 * retirer la note le rouvre. L'application ne fait que suivre cet état,
 * elle ne le décide jamais.
 *
 * Le contenu d'un rendu est un modèle Meriz enregistré tel quel, au même
 * format que le contenu d'un document (voir persistence.ts).
 */

export type SubmissionStatus = 'submitted' | 'graded'

/** Ligne de liste, côté prof : le contenu du modèle n'y est pas. */
export interface SubmissionSummary {
  id: string
  assignmentId: string
  student: PublicProfile
  status: SubmissionStatus
  /** Date du dépôt, réécrite à chaque nouveau dépôt. */
  submittedAt: string | null
  /** Retard calculé par le serveur, jamais recalculé ici. */
  isLate: boolean
  /** Note libre du prof : « 16/20 », « Acquis »... null tant qu'il n'a pas noté. */
  grade: string | null
  feedback: string | null
  gradedAt: string | null
  createdAt: string | null
  updatedAt: string | null
}

/** Rendu ouvert : le modèle remis est là. */
export interface Submission extends SubmissionSummary {
  content: string
}

export interface GradeDraft {
  grade: string
  /** Toujours envoyé : renoter sans commentaire efface l'ancien. */
  feedback: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseSubmissionSummary(raw: unknown): SubmissionSummary | null {
  if (
    !isRecord(raw) ||
    typeof raw.id !== 'string' ||
    raw.id === '' ||
    typeof raw.assignment_id !== 'string' ||
    (raw.status !== 'submitted' && raw.status !== 'graded')
  ) {
    return null
  }
  const student = parsePublicProfile(raw.student)
  if (!student) {
    return null
  }
  const submittedAt = optionalText(raw.submitted_at)
  const grade = optionalText(raw.grade)
  const feedback = optionalText(raw.feedback)
  const gradedAt = optionalText(raw.graded_at)
  const createdAt = optionalText(raw.created_at)
  const updatedAt = optionalText(raw.updated_at)
  if (
    submittedAt === undefined ||
    grade === undefined ||
    feedback === undefined ||
    gradedAt === undefined ||
    createdAt === undefined ||
    updatedAt === undefined
  ) {
    return null
  }
  return {
    id: raw.id,
    assignmentId: raw.assignment_id,
    student,
    status: raw.status,
    submittedAt,
    isLate: raw.is_late === true,
    grade,
    feedback,
    gradedAt,
    createdAt,
    updatedAt,
  }
}

export function parseSubmission(raw: unknown): Submission | null {
  const summary = parseSubmissionSummary(raw)
  if (!summary || !isRecord(raw) || typeof raw.content !== 'string') {
    return null
  }
  return { ...summary, content: raw.content }
}

function assignmentPath(id: string, suffix: string): string {
  return `/assignments/${encodeURIComponent(id)}${suffix}`
}

function submissionPath(id: string, suffix = ''): string {
  return `/submissions/${encodeURIComponent(id)}${suffix}`
}

/** Appel qui renvoie un rendu complet, contenu compris. */
async function detailRequest(
  client: ApiClient,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<Outcome<Submission>> {
  const result = await client.request(method, path, body)
  if (!result.ok) {
    return result
  }
  const submission = parseSubmission(result.data)
  return submission ? { ok: true, value: submission } : { ok: false, error: unexpectedResponse(result.status) }
}

/** Les rendus d'un devoir, pour le prof. Le serveur les trie du plus récent au plus ancien. */
export async function listAssignmentSubmissions(
  client: ApiClient,
  assignmentId: string,
): Promise<Outcome<SubmissionSummary[]>> {
  const result = await client.request('GET', assignmentPath(assignmentId, '/submissions'))
  if (!result.ok) {
    return result
  }
  if (!Array.isArray(result.data)) {
    return { ok: false, error: unexpectedResponse(result.status) }
  }
  const submissions: SubmissionSummary[] = []
  for (const item of result.data) {
    const parsed = parseSubmissionSummary(item)
    if (!parsed) {
      return { ok: false, error: unexpectedResponse(result.status) }
    }
    submissions.push(parsed)
  }
  return { ok: true, value: submissions }
}

/**
 * Mon rendu pour ce devoir. Une erreur « introuvable » est un état
 * normal : l'élève n'a encore rien rendu. L'appelant la traite ainsi.
 */
export function getMySubmission(client: ApiClient, assignmentId: string): Promise<Outcome<Submission>> {
  return detailRequest(client, 'GET', assignmentPath(assignmentId, '/submission'))
}

export function getSubmission(client: ApiClient, id: string): Promise<Outcome<Submission>> {
  return detailRequest(client, 'GET', submissionPath(id))
}

/** Rendre son travail. Le serveur crée le rendu ou remplace le précédent. */
export function submitWork(
  client: ApiClient,
  assignmentId: string,
  content: string,
): Promise<Outcome<Submission>> {
  return detailRequest(client, 'PUT', assignmentPath(assignmentId, '/submission'), { content })
}

export function gradeSubmission(client: ApiClient, id: string, draft: GradeDraft): Promise<Outcome<Submission>> {
  return detailRequest(client, 'POST', submissionPath(id, '/grade'), {
    grade: draft.grade,
    feedback: draft.feedback,
  })
}

/** Retirer la note : le rendu redevient modifiable par l'élève. */
export function removeGrade(client: ApiClient, id: string): Promise<Outcome<Submission>> {
  return detailRequest(client, 'DELETE', submissionPath(id, '/grade'))
}

/* ------------------------------------------------------------------ */
/* Affichage                                                          */

const submittedFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' })

/** « Rendu le 1 octobre 2026 à 18:00 », ou un repli si la date est illisible. */
export function formatSubmittedAt(iso: string | null): string {
  if (iso === null) return 'Date de dépôt inconnue'
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? 'Date de dépôt inconnue' : `Rendu le ${submittedFormat.format(date)}`
}

/** Avancement d'un élève sur un devoir, écrit en toutes lettres. */
export type WorkState = 'todo' | 'started' | 'submitted' | 'graded'

export function workStateLabel(state: WorkState): string {
  if (state === 'graded') return 'Noté'
  if (state === 'submitted') return 'Rendu'
  if (state === 'started') return 'En cours'
  return 'À faire'
}

/**
 * L'état vient du serveur d'abord : un rendu noté prime sur tout, puis
 * un rendu déposé. Le travail commencé n'est connu que du navigateur.
 */
export function workState(submission: SubmissionSummary | null, hasWorkDocument: boolean): WorkState {
  if (submission?.status === 'graded') return 'graded'
  if (submission) return 'submitted'
  return hasWorkDocument ? 'started' : 'todo'
}
