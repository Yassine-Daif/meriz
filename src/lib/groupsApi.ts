import type { ApiClient, Outcome } from './apiClient'
import { unexpectedResponse } from './apiClient'
import { optionalText } from './authApi'
import { normalizeJoinCode, parsePublicProfile } from './classroomsApi'
import type { PublicProfile } from './classroomsApi'
import { parseCloudMeta } from './documentsApi'
import type { CloudDocumentMeta } from './documentsApi'

/**
 * Groupes d'élèves : créer, rejoindre par code, gérer ses membres, et
 * travailler à plusieurs sur des documents partagés. C'est entre pairs,
 * sans prof ni note.
 *
 * Le code d'adhésion a la même forme que celui d'une classe, donc la
 * normalisation et l'affichage viennent de `classroomsApi`. Le code ne
 * revient qu'au créateur : l'application ne l'affiche que s'il est là.
 *
 * Un document de groupe se lit et s'enregistre par les routes
 * ordinaires des documents, `documentsApi`. Seules la liste et la
 * création passent par le groupe.
 */

export type GroupRole = 'admin' | 'member'

export interface GroupMember extends PublicProfile {
  /** Le créateur du groupe : il ne se retire pas et ne le quitte pas. */
  isAdmin: boolean
  joinedAt: string | null
}

export interface GroupDocument extends CloudDocumentMeta {
  groupId: string
  /** Contenu, seulement quand la route le renvoie (à la création). */
  content: string | null
}

export interface GroupSummary {
  id: string
  name: string
  /** Mon rôle : « admin » pour le créateur du groupe. */
  myRole: GroupRole
  /** Code pour rejoindre, visible du créateur seulement. */
  joinCode: string | null
  membersCount: number | null
  documentsCount: number | null
  creator: PublicProfile | null
  createdAt: string | null
}

export interface GroupDetail extends GroupSummary {
  members: GroupMember[]
  /**
   * Documents partagés, ou null quand la route ne les donne pas : c'est
   * le cas de l'adhésion. Un tableau vide veut dire « aucun document ».
   */
  documents: GroupDocument[] | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseGroupDocument(raw: unknown): GroupDocument | null {
  const meta = parseCloudMeta(raw)
  if (!meta || !isRecord(raw) || typeof raw.group_id !== 'string' || raw.group_id === '') {
    return null
  }
  if (raw.content !== undefined && typeof raw.content !== 'string') {
    return null
  }
  return { ...meta, groupId: raw.group_id, content: typeof raw.content === 'string' ? raw.content : null }
}

export function parseGroupSummary(raw: unknown): GroupSummary | null {
  if (
    !isRecord(raw) ||
    typeof raw.id !== 'string' ||
    raw.id === '' ||
    typeof raw.name !== 'string' ||
    (raw.my_role !== 'admin' && raw.my_role !== 'member')
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
  if (raw.documents_count !== undefined && typeof raw.documents_count !== 'number') {
    return null
  }
  let creator: PublicProfile | null = null
  if (raw.creator !== undefined && raw.creator !== null) {
    creator = parsePublicProfile(raw.creator)
    if (!creator) return null
  }
  return {
    id: raw.id,
    name: raw.name,
    myRole: raw.my_role,
    joinCode,
    membersCount: typeof raw.members_count === 'number' ? raw.members_count : null,
    documentsCount: typeof raw.documents_count === 'number' ? raw.documents_count : null,
    creator,
    createdAt,
  }
}

export function parseGroupDetail(raw: unknown): GroupDetail | null {
  const summary = parseGroupSummary(raw)
  if (!summary || !isRecord(raw) || !Array.isArray(raw.members)) {
    return null
  }
  const members: GroupMember[] = []
  for (const item of raw.members) {
    const profile = parsePublicProfile(item)
    const joinedAt = isRecord(item) ? optionalText(item.joined_at) : undefined
    if (!profile || joinedAt === undefined) {
      return null
    }
    members.push({ ...profile, isAdmin: isRecord(item) && item.is_admin === true, joinedAt })
  }
  // L'adhésion ne renvoie pas les documents : leur absence est normale,
  // leur présence doit être lisible.
  let documents: GroupDocument[] | null = null
  if (raw.documents !== undefined && raw.documents !== null) {
    if (!Array.isArray(raw.documents)) return null
    documents = []
    for (const item of raw.documents) {
      const document = parseGroupDocument(item)
      if (!document) return null
      documents.push(document)
    }
  }
  return { ...summary, members, documents }
}

/* ------------------------------------------------------------------ */
/* Appels                                                              */

function groupPath(id: string): string {
  return `/groups/${encodeURIComponent(id)}`
}

async function detailRequest(
  client: ApiClient,
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: Record<string, string>,
): Promise<Outcome<GroupDetail>> {
  const result = await client.request(method, path, body)
  if (!result.ok) return result
  const group = parseGroupDetail(result.data)
  return group ? { ok: true, value: group } : { ok: false, error: unexpectedResponse(result.status) }
}

async function emptyRequest(client: ApiClient, path: string): Promise<Outcome<void>> {
  const result = await client.request('DELETE', path)
  return result.ok ? { ok: true, value: undefined } : result
}

export async function listGroups(client: ApiClient): Promise<Outcome<GroupSummary[]>> {
  const result = await client.request('GET', '/groups')
  if (!result.ok) return result
  if (!Array.isArray(result.data)) {
    return { ok: false, error: unexpectedResponse(result.status) }
  }
  const groups: GroupSummary[] = []
  for (const raw of result.data) {
    const group = parseGroupSummary(raw)
    if (!group) return { ok: false, error: unexpectedResponse(result.status) }
    groups.push(group)
  }
  return { ok: true, value: groups }
}

export function getGroup(client: ApiClient, id: string): Promise<Outcome<GroupDetail>> {
  return detailRequest(client, 'GET', groupPath(id))
}

/** Rejoindre par code. Le code est normalisé avant l'envoi. */
export function joinGroup(client: ApiClient, code: string): Promise<Outcome<GroupDetail>> {
  return detailRequest(client, 'POST', '/groups/join', { code: normalizeJoinCode(code) })
}

export function createGroup(client: ApiClient, name: string): Promise<Outcome<GroupDetail>> {
  return detailRequest(client, 'POST', '/groups', { name })
}

export function renameGroup(client: ApiClient, id: string, name: string): Promise<Outcome<GroupDetail>> {
  return detailRequest(client, 'PATCH', groupPath(id), { name })
}

/** Nouveau code : l'ancien cesse aussitôt de fonctionner. */
export function regenerateGroupCode(client: ApiClient, id: string): Promise<Outcome<GroupDetail>> {
  return detailRequest(client, 'POST', `${groupPath(id)}/code`)
}

export function deleteGroup(client: ApiClient, id: string): Promise<Outcome<void>> {
  return emptyRequest(client, groupPath(id))
}

/** Quitter le groupe. Le serveur refuse au créateur, qui doit supprimer. */
export function leaveGroup(client: ApiClient, id: string): Promise<Outcome<void>> {
  return emptyRequest(client, `${groupPath(id)}/membership`)
}

export function removeGroupMember(client: ApiClient, id: string, memberId: number): Promise<Outcome<void>> {
  return emptyRequest(client, `${groupPath(id)}/members/${memberId}`)
}

export async function listGroupDocuments(client: ApiClient, id: string): Promise<Outcome<GroupDocument[]>> {
  const result = await client.request('GET', `${groupPath(id)}/documents`)
  if (!result.ok) return result
  if (!Array.isArray(result.data)) {
    return { ok: false, error: unexpectedResponse(result.status) }
  }
  const documents: GroupDocument[] = []
  for (const raw of result.data) {
    const document = parseGroupDocument(raw)
    if (!document) return { ok: false, error: unexpectedResponse(result.status) }
    documents.push(document)
  }
  return { ok: true, value: documents }
}

export async function createGroupDocument(
  client: ApiClient,
  id: string,
  data: { name: string; content: string },
): Promise<Outcome<GroupDocument>> {
  const result = await client.request('POST', `${groupPath(id)}/documents`, data)
  if (!result.ok) return result
  const document = parseGroupDocument(result.data)
  return document ? { ok: true, value: document } : { ok: false, error: unexpectedResponse(result.status) }
}
