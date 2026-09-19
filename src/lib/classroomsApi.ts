import type { ApiClient, Outcome } from './apiClient'
import { unexpectedResponse } from './apiClient'
import { optionalText } from './authApi'
import { DEFAULT_AVATAR_BG, DEFAULT_AVATAR_FG, parseAvatarColor } from './color'

/**
 * Classes : rejoindre par code côté élève, créer et gérer côté prof.
 * Les personnes arrivent toujours en profil public, sans email de
 * connexion. Le code et les dates d'arrivée ne sont renvoyés qu'au prof
 * de la classe : l'application ne les affiche que s'ils sont présents.
 */

export interface PublicProfile {
  id: number
  name: string
  firstName: string | null
  /** Présentation, seulement si la personne la partage. */
  bio: string | null
  /** Contact, seulement si la personne le partage. */
  contact: string | null
  /** Couleurs de la pastille d'initiales : toujours visibles. */
  avatarBg: string
  avatarFg: string
}

export interface ClassroomMember extends PublicProfile {
  /** Date d'arrivée, visible par le prof de la classe seulement. */
  joinedAt: string | null
}

export type ClassroomRole = 'teacher' | 'student'

export interface ClassroomSummary {
  id: string
  name: string
  /** Mon rôle dans cette classe. */
  myRole: ClassroomRole
  /** Code pour rejoindre, visible par le prof de la classe seulement. */
  joinCode: string | null
  membersCount: number | null
  teacher: PublicProfile | null
  createdAt: string | null
}

export interface ClassroomDetail extends ClassroomSummary {
  members: ClassroomMember[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parsePublicProfile(raw: unknown): PublicProfile | null {
  if (!isRecord(raw) || typeof raw.id !== 'number' || typeof raw.name !== 'string') {
    return null
  }
  const firstName = optionalText(raw.first_name)
  const bio = optionalText(raw.bio)
  const contact = optionalText(raw.contact)
  if (firstName === undefined || bio === undefined || contact === undefined) {
    return null
  }
  return {
    id: raw.id,
    name: raw.name,
    firstName,
    bio,
    contact,
    avatarBg: parseAvatarColor(raw.avatar_bg, DEFAULT_AVATAR_BG),
    avatarFg: parseAvatarColor(raw.avatar_fg, DEFAULT_AVATAR_FG),
  }
}

export function parseClassroomSummary(raw: unknown): ClassroomSummary | null {
  if (
    !isRecord(raw) ||
    typeof raw.id !== 'string' ||
    raw.id === '' ||
    typeof raw.name !== 'string' ||
    (raw.my_role !== 'teacher' && raw.my_role !== 'student')
  ) {
    return null
  }
  const joinCode = optionalText(raw.join_code)
  const createdAt = optionalText(raw.created_at)
  if (joinCode === undefined || createdAt === undefined) {
    return null
  }
  if (raw.members_count !== undefined && typeof raw.members_count !== 'number') {
    return null
  }
  let teacher: PublicProfile | null = null
  if (raw.teacher !== undefined && raw.teacher !== null) {
    teacher = parsePublicProfile(raw.teacher)
    if (!teacher) return null
  }
  return {
    id: raw.id,
    name: raw.name,
    myRole: raw.my_role,
    joinCode,
    membersCount: typeof raw.members_count === 'number' ? raw.members_count : null,
    teacher,
    createdAt,
  }
}

export function parseClassroomDetail(raw: unknown): ClassroomDetail | null {
  const summary = parseClassroomSummary(raw)
  if (!summary || !isRecord(raw) || !Array.isArray(raw.members)) {
    return null
  }
  const members: ClassroomMember[] = []
  for (const item of raw.members) {
    const profile = parsePublicProfile(item)
    const joinedAt = isRecord(item) ? optionalText(item.joined_at) : undefined
    if (!profile || joinedAt === undefined) {
      return null
    }
    members.push({ ...profile, joinedAt })
  }
  return { ...summary, members }
}

/* ------------------------------------------------------------------ */
/* Code de classe                                                      */

/** Règle du serveur : majuscules, sans espaces ni tirets. */
export function normalizeJoinCode(input: string): string {
  return input.replace(/[\s-]+/g, '').toUpperCase()
}

/** Affichage lisible : « ABCD-EFGH ». La saisie accepte cette forme. */
export function formatJoinCode(code: string): string {
  const normalized = normalizeJoinCode(code)
  return normalized.length === 8 ? `${normalized.slice(0, 4)}-${normalized.slice(4)}` : normalized
}

/* ------------------------------------------------------------------ */
/* Appels                                                              */

function classroomPath(id: string): string {
  return `/classrooms/${encodeURIComponent(id)}`
}

async function detailRequest(
  client: ApiClient,
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: Record<string, string>,
): Promise<Outcome<ClassroomDetail>> {
  const result = await client.request(method, path, body)
  if (!result.ok) return result
  const classroom = parseClassroomDetail(result.data)
  return classroom ? { ok: true, value: classroom } : { ok: false, error: unexpectedResponse(result.status) }
}

async function emptyRequest(client: ApiClient, path: string): Promise<Outcome<void>> {
  const result = await client.request('DELETE', path)
  return result.ok ? { ok: true, value: undefined } : result
}

export async function listClassrooms(client: ApiClient): Promise<Outcome<ClassroomSummary[]>> {
  const result = await client.request('GET', '/classrooms')
  if (!result.ok) return result
  if (!Array.isArray(result.data)) {
    return { ok: false, error: unexpectedResponse(result.status) }
  }
  const classrooms: ClassroomSummary[] = []
  for (const raw of result.data) {
    const classroom = parseClassroomSummary(raw)
    if (!classroom) return { ok: false, error: unexpectedResponse(result.status) }
    classrooms.push(classroom)
  }
  return { ok: true, value: classrooms }
}

export function getClassroom(client: ApiClient, id: string): Promise<Outcome<ClassroomDetail>> {
  return detailRequest(client, 'GET', classroomPath(id))
}

/** Rejoindre par code (élève). Le code est normalisé avant l'envoi. */
export function joinClassroom(client: ApiClient, code: string): Promise<Outcome<ClassroomDetail>> {
  return detailRequest(client, 'POST', '/classrooms/join', { code: normalizeJoinCode(code) })
}

export function leaveClassroom(client: ApiClient, id: string): Promise<Outcome<void>> {
  return emptyRequest(client, `${classroomPath(id)}/membership`)
}

/** Créer une classe (compte prof). */
export function createClassroom(client: ApiClient, name: string): Promise<Outcome<ClassroomDetail>> {
  return detailRequest(client, 'POST', '/classrooms', { name })
}

export function renameClassroom(client: ApiClient, id: string, name: string): Promise<Outcome<ClassroomDetail>> {
  return detailRequest(client, 'PATCH', classroomPath(id), { name })
}

/** Nouveau code : l'ancien cesse de fonctionner. */
export function regenerateJoinCode(client: ApiClient, id: string): Promise<Outcome<ClassroomDetail>> {
  return detailRequest(client, 'POST', `${classroomPath(id)}/code`)
}

export function deleteClassroom(client: ApiClient, id: string): Promise<Outcome<void>> {
  return emptyRequest(client, classroomPath(id))
}

export function removeMember(client: ApiClient, id: string, memberId: number): Promise<Outcome<void>> {
  return emptyRequest(client, `${classroomPath(id)}/members/${memberId}`)
}
