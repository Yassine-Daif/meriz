import type { ApiClient, Outcome } from './apiClient'
import { unexpectedResponse } from './apiClient'
import { optionalText } from './authApi'
import type { AssignmentType } from './assignmentsApi'
import { parsePublicProfile } from './classroomsApi'
import type { PublicProfile } from './classroomsApi'
import type { SubmissionStatus, WorkState } from './submissionsApi'

/**
 * Vues d'ensemble : ce qu'une personne a devant elle, toutes classes
 * confondues. Le serveur regroupe et trie, l'application se contente de
 * lire. Un seul appel par écran, jamais un appel par classe.
 *
 * Ces listes ne transportent aucun modèle : ouvrir une ligne passe par
 * les écrans déjà en place, qui vont chercher ce qu'il leur faut.
 */

/** La classe d'où vient une ligne, de quoi la nommer et y mener. */
export interface OverviewClassroom {
  id: string
  name: string
}

/** Un rendu qui attend une note, côté prof. */
export interface ToGradeRow {
  submissionId: string
  submittedAt: string | null
  /** Retard calculé par le serveur, jamais recalculé ici. */
  isLate: boolean
  student: PublicProfile
  assignment: {
    id: string
    title: string
    type: AssignmentType
    dueAt: string | null
  }
  classroom: OverviewClassroom
}

/** Une page de liste, telle que le serveur la découpe. */
export interface ListPage<T> {
  rows: T[]
  currentPage: number
  lastPage: number
  total: number
}

/** Mon rendu sur un devoir, vu depuis la liste d'ensemble. */
export interface MySubmissionState {
  id: string
  status: SubmissionStatus
  submittedAt: string | null
  isLate: boolean
  grade: string | null
  feedback: string | null
  gradedAt: string | null
}

/** Un devoir d'élève, toutes classes confondues. */
export interface StudentAssignmentRow {
  id: string
  title: string
  type: AssignmentType
  dueAt: string | null
  /** Échéance dépassée, d'après l'horloge du serveur. */
  isOverdue: boolean
  classroom: OverviewClassroom
  hasBase: boolean
  hasImage: boolean
  /** Avancement décidé par le serveur, dans le vocabulaire maison. */
  state: WorkState
  /** Travail commencé à rouvrir, s'il existe. */
  documentId: string | null
  submission: MySubmissionState | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseAssignmentType(value: unknown): AssignmentType | null {
  return value === 'exercise' || value === 'exam' ? value : null
}

function parseClassroom(raw: unknown): OverviewClassroom | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || raw.id === '' || typeof raw.name !== 'string') {
    return null
  }
  return { id: raw.id, name: raw.name }
}

export function parseToGradeRow(raw: unknown): ToGradeRow | null {
  if (!isRecord(raw) || typeof raw.submission_id !== 'string' || raw.submission_id === '') {
    return null
  }
  const student = parsePublicProfile(raw.student)
  const classroom = parseClassroom(raw.classroom)
  if (!student || !classroom || !isRecord(raw.assignment)) {
    return null
  }
  const assignment = raw.assignment
  const type = parseAssignmentType(assignment.type)
  if (typeof assignment.id !== 'string' || assignment.id === '' || typeof assignment.title !== 'string' || !type) {
    return null
  }
  const submittedAt = optionalText(raw.submitted_at)
  const dueAt = optionalText(assignment.due_at)
  if (submittedAt === undefined || dueAt === undefined) {
    return null
  }
  return {
    submissionId: raw.submission_id,
    submittedAt,
    isLate: raw.is_late === true,
    student,
    assignment: { id: assignment.id, title: assignment.title, type, dueAt },
    classroom,
  }
}

/** Le serveur dit « in_progress », la maison dit « started ». */
function parseWorkState(value: unknown): WorkState | null {
  if (value === 'todo' || value === 'submitted' || value === 'graded') return value
  return value === 'in_progress' ? 'started' : null
}

function parseMySubmission(raw: unknown): MySubmissionState | null | undefined {
  if (raw === null || raw === undefined) {
    return null
  }
  if (
    !isRecord(raw) ||
    typeof raw.id !== 'string' ||
    raw.id === '' ||
    (raw.status !== 'submitted' && raw.status !== 'graded')
  ) {
    return undefined
  }
  const submittedAt = optionalText(raw.submitted_at)
  const grade = optionalText(raw.grade)
  const feedback = optionalText(raw.feedback)
  const gradedAt = optionalText(raw.graded_at)
  if (submittedAt === undefined || grade === undefined || feedback === undefined || gradedAt === undefined) {
    return undefined
  }
  return {
    id: raw.id,
    status: raw.status,
    submittedAt,
    // Le serveur laisse passer un retard inconnu : sans preuve, pas de retard.
    isLate: raw.is_late === true,
    grade,
    feedback,
    gradedAt,
  }
}

export function parseStudentAssignmentRow(raw: unknown): StudentAssignmentRow | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || raw.id === '' || typeof raw.title !== 'string') {
    return null
  }
  const type = parseAssignmentType(raw.type)
  const state = parseWorkState(raw.state)
  const classroom = parseClassroom(raw.classroom)
  if (!type || !state || !classroom) {
    return null
  }
  const dueAt = optionalText(raw.due_at)
  const documentId = optionalText(raw.document_id)
  const submission = parseMySubmission(raw.submission)
  if (dueAt === undefined || documentId === undefined || submission === undefined) {
    return null
  }
  return {
    id: raw.id,
    title: raw.title,
    type,
    dueAt,
    isOverdue: raw.is_overdue === true,
    classroom,
    hasBase: raw.has_base === true,
    hasImage: raw.has_image === true,
    state,
    documentId,
    submission,
  }
}

/** Numéro de page lu dans l'enveloppe, avec un repli sur la page demandée. */
function readMeta(body: unknown, key: string, fallback: number): number {
  if (!isRecord(body) || !isRecord(body.meta)) {
    return fallback
  }
  const value = body.meta[key]
  return typeof value === 'number' ? value : fallback
}

/**
 * Les rendus qui attendent une note, toutes classes du prof confondues,
 * les plus anciens d'abord. La liste est paginée par le serveur : une
 * page à l'arrivée, les suivantes seulement si on les demande.
 */
export async function listToGrade(client: ApiClient, page = 1): Promise<Outcome<ListPage<ToGradeRow>>> {
  const result = await client.request('GET', `/overview/to-grade?page=${page}`)
  if (!result.ok) {
    return result
  }
  if (!Array.isArray(result.data)) {
    return { ok: false, error: unexpectedResponse(result.status) }
  }
  const rows: ToGradeRow[] = []
  for (const item of result.data) {
    const parsed = parseToGradeRow(item)
    if (!parsed) {
      return { ok: false, error: unexpectedResponse(result.status) }
    }
    rows.push(parsed)
  }
  const currentPage = readMeta(result.body, 'current_page', page)
  return {
    ok: true,
    value: {
      rows,
      currentPage,
      lastPage: readMeta(result.body, 'last_page', currentPage),
      total: readMeta(result.body, 'total', rows.length),
    },
  }
}

/**
 * Mes devoirs, toutes classes confondues, triés par échéance. Le serveur
 * renvoie tout d'un coup : il n'y a pas de pagination à gérer ici.
 */
export async function listMyAssignments(client: ApiClient): Promise<Outcome<StudentAssignmentRow[]>> {
  const result = await client.request('GET', '/overview/my-assignments')
  if (!result.ok) {
    return result
  }
  if (!Array.isArray(result.data)) {
    return { ok: false, error: unexpectedResponse(result.status) }
  }
  const rows: StudentAssignmentRow[] = []
  for (const item of result.data) {
    const parsed = parseStudentAssignmentRow(item)
    if (!parsed) {
      return { ok: false, error: unexpectedResponse(result.status) }
    }
    rows.push(parsed)
  }
  return { ok: true, value: rows }
}

/* ------------------------------------------------------------------ */
/* Affichage                                                          */

/** « 12 rendus affichés sur 30 », ou le compte seul quand tout est là. */
export function pageCountLabel(shown: number, total: number): string {
  if (shown >= total) {
    return total > 1 ? `${total} rendus` : `${total} rendu`
  }
  const plural = shown > 1 ? 's' : ''
  return `${shown} rendu${plural} affiché${plural} sur ${total}`
}
