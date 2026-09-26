import type { ApiClient, Outcome } from './apiClient'
import { unexpectedResponse } from './apiClient'
import { optionalText } from './authApi'
import { parseAssignment } from './assignmentsApi'
import type { Assignment } from './assignmentsApi'
import { parsePublicProfile } from './classroomsApi'
import type { PublicProfile } from './classroomsApi'
import { formatRelativeDate } from './formatDate'
import type { SubmissionStatus } from './submissionsApi'

/**
 * Suivi en direct d'un devoir. Le prof ouvre le suivi, voit qui
 * travaille, et consulte le modèle d'un élève en lecture seule. Rien
 * n'est modifiable : le serveur n'offre aucune écriture ici, et chaque
 * consultation laisse une trace que l'élève peut lire.
 *
 * La liste ne transporte aucun contenu. L'instantané, lui, rend le
 * modèle tel que l'élève l'a enregistré.
 */

/** Une ligne d'avancement, sans le moindre contenu. */
export interface LiveWorker {
  student: PublicProfile
  hasStarted: boolean
  /** Dernière modification de son travail, jamais touchée par l'observation. */
  lastActivityAt: string | null
  /** Dernière fois que son prof a ouvert ce travail. */
  lastObservedAt: string | null
  submissionStatus: SubmissionStatus | null
}

/** Le modèle d'un élève à cet instant, en lecture seule. */
export interface LiveSnapshot {
  documentId: string
  student: PublicProfile
  name: string
  content: string
  /** Dernière modification par l'élève. */
  updatedAt: string | null
  /** Instant de cette lecture, celui que l'élève verra. */
  observedAt: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Le serveur connaît un état « brouillon » que l'application n'utilise
 * pas : tout ce qui n'est ni rendu ni noté vaut « rien de rendu ».
 */
function parseSubmissionStatus(value: unknown): SubmissionStatus | null {
  return value === 'submitted' || value === 'graded' ? value : null
}

export function parseLiveWorker(raw: unknown): LiveWorker | null {
  if (!isRecord(raw)) {
    return null
  }
  const student = parsePublicProfile(raw.student)
  if (!student) {
    return null
  }
  const lastActivityAt = optionalText(raw.last_activity_at)
  const lastObservedAt = optionalText(raw.last_observed_at)
  if (lastActivityAt === undefined || lastObservedAt === undefined) {
    return null
  }
  return {
    student,
    hasStarted: raw.has_started === true,
    lastActivityAt,
    lastObservedAt,
    submissionStatus: parseSubmissionStatus(raw.submission_status),
  }
}

export function parseLiveSnapshot(raw: unknown): LiveSnapshot | null {
  if (
    !isRecord(raw) ||
    typeof raw.document_id !== 'string' ||
    raw.document_id === '' ||
    typeof raw.name !== 'string' ||
    typeof raw.content !== 'string'
  ) {
    return null
  }
  const student = parsePublicProfile(raw.student)
  if (!student) {
    return null
  }
  const updatedAt = optionalText(raw.updated_at)
  const observedAt = optionalText(raw.observed_at)
  if (updatedAt === undefined || observedAt === undefined) {
    return null
  }
  return {
    documentId: raw.document_id,
    student,
    name: raw.name,
    content: raw.content,
    updatedAt,
    observedAt,
  }
}

function assignmentPath(id: string, suffix = ''): string {
  return `/assignments/${encodeURIComponent(id)}${suffix}`
}

/** Appel qui renvoie le devoir, drapeau de suivi compris. */
async function trackingRequest(
  client: ApiClient,
  method: 'POST' | 'DELETE',
  assignmentId: string,
): Promise<Outcome<Assignment>> {
  const result = await client.request(method, assignmentPath(assignmentId, '/live-tracking'))
  if (!result.ok) {
    return result
  }
  const assignment = parseAssignment(result.data)
  return assignment ? { ok: true, value: assignment } : { ok: false, error: unexpectedResponse(result.status) }
}

/** Ouvrir le suivi. L'élève le voit aussitôt dans son devoir. */
export function enableLiveTracking(client: ApiClient, assignmentId: string): Promise<Outcome<Assignment>> {
  return trackingRequest(client, 'POST', assignmentId)
}

export function disableLiveTracking(client: ApiClient, assignmentId: string): Promise<Outcome<Assignment>> {
  return trackingRequest(client, 'DELETE', assignmentId)
}

/** L'avancement de la classe. Une ligne illisible invalide toute la liste. */
export async function listLiveWorkers(
  client: ApiClient,
  assignmentId: string,
): Promise<Outcome<LiveWorker[]>> {
  const result = await client.request('GET', assignmentPath(assignmentId, '/live'))
  if (!result.ok) {
    return result
  }
  if (!Array.isArray(result.data)) {
    return { ok: false, error: unexpectedResponse(result.status) }
  }
  const workers: LiveWorker[] = []
  for (const item of result.data) {
    const parsed = parseLiveWorker(item)
    if (!parsed) {
      return { ok: false, error: unexpectedResponse(result.status) }
    }
    workers.push(parsed)
  }
  return { ok: true, value: workers }
}

/**
 * Le modèle d'un élève à cet instant. Une erreur « introuvable » est un
 * état normal : cet élève n'a pas encore commencé. L'appelant la traite
 * ainsi, comme pour le rendu d'un devoir jamais remis.
 */
export async function getLiveSnapshot(
  client: ApiClient,
  assignmentId: string,
  studentId: number,
): Promise<Outcome<LiveSnapshot>> {
  const result = await client.request(
    'GET',
    assignmentPath(assignmentId, `/live/${encodeURIComponent(String(studentId))}`),
  )
  if (!result.ok) {
    return result
  }
  const snapshot = parseLiveSnapshot(result.data)
  return snapshot ? { ok: true, value: snapshot } : { ok: false, error: unexpectedResponse(result.status) }
}

/**
 * L'heure de dernière lecture de mon travail, lue sur mon propre
 * document. C'est la seule route qui la porte ; le contenu redescend
 * avec, on s'en passe.
 */
export async function getLastObservedAt(client: ApiClient, documentId: string): Promise<Outcome<string | null>> {
  const result = await client.request('GET', `/documents/${encodeURIComponent(documentId)}`)
  if (!result.ok) {
    return result
  }
  if (!isRecord(result.data)) {
    return { ok: false, error: unexpectedResponse(result.status) }
  }
  const observedAt = optionalText(result.data.last_observed_at)
  return observedAt === undefined
    ? { ok: false, error: unexpectedResponse(result.status) }
    : { ok: true, value: observedAt }
}

/* ------------------------------------------------------------------ */
/* Affichage                                                          */

/** L'avancement d'un élève, en toutes lettres. */
export function liveStateLabel(worker: LiveWorker): string {
  if (worker.submissionStatus === 'graded') return 'Noté'
  if (worker.submissionStatus === 'submitted') return 'Rendu'
  return worker.hasStarted ? 'Au travail' : 'N’a pas commencé'
}

/** Moins d'une minute : le relatif dirait « maintenant », on préfère la phrase. */
const JUST_NOW_MS = 60_000

function since(iso: string, now: number, prefix: string): string | null {
  const time = new Date(iso).getTime()
  if (Number.isNaN(time)) {
    return null
  }
  if (now - time < JUST_NOW_MS) {
    return `${prefix} à l’instant`
  }
  const relative = formatRelativeDate(iso, now)
  return relative === null ? null : `${prefix} ${relative}`
}

/** « Activité il y a 2 minutes », ou l'absence d'activité. */
export function formatLastActivity(iso: string | null, now: number = Date.now()): string {
  if (iso === null) return 'Aucune activité'
  return since(iso, now, 'Activité') ?? 'Activité à une date inconnue'
}

/** « Lu il y a une minute » : quand ce travail a été consulté. null si jamais. */
export function formatLastObservation(iso: string | null, now: number = Date.now()): string | null {
  return iso === null ? null : since(iso, now, 'Lu')
}
