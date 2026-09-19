import type { ApiClient, Outcome } from './apiClient'
import { unexpectedResponse } from './apiClient'
import { parseApiUser } from './authApi'
import type { ApiUser } from './authApi'

/**
 * Mon profil : nom, prénom, présentation et contact, avec leurs
 * interrupteurs de partage. L'email de connexion ne se modifie pas ici
 * et n'est jamais montré aux autres.
 */

export interface ProfilePatch {
  name?: string
  firstName?: string
  bio?: string | null
  bioShared?: boolean
  contact?: string | null
  contactShared?: boolean
  /** Couleurs de la pastille, hexadécimales (« #aabbcc »). */
  avatarBg?: string
  avatarFg?: string
}

export async function updateProfile(client: ApiClient, patch: ProfilePatch): Promise<Outcome<ApiUser>> {
  const body: Record<string, string | boolean | null> = {}
  if (patch.name !== undefined) body.name = patch.name
  if (patch.firstName !== undefined) body.first_name = patch.firstName
  if (patch.bio !== undefined) body.bio = patch.bio
  if (patch.bioShared !== undefined) body.bio_shared = patch.bioShared
  if (patch.contact !== undefined) body.contact = patch.contact
  if (patch.contactShared !== undefined) body.contact_shared = patch.contactShared
  if (patch.avatarBg !== undefined) body.avatar_bg = patch.avatarBg
  if (patch.avatarFg !== undefined) body.avatar_fg = patch.avatarFg

  const result = await client.request('PATCH', '/me', body)
  if (!result.ok) {
    return result
  }
  const user = parseApiUser(result.data)
  return user ? { ok: true, value: user } : { ok: false, error: unexpectedResponse(result.status) }
}

/**
 * Active le mode prof. C'est le serveur qui décide : réservé aux adresses
 * scolaires ou universitaires, sinon un refus 403 avec son message.
 */
export async function becomeTeacher(client: ApiClient): Promise<Outcome<ApiUser>> {
  const result = await client.request('POST', '/me/teacher-role')
  if (!result.ok) {
    return result
  }
  const user = parseApiUser(result.data)
  return user ? { ok: true, value: user } : { ok: false, error: unexpectedResponse(result.status) }
}

/** Ce qu'autrui voit de moi, calculé comme le serveur : partagé et rempli. */
export interface PublicPreview {
  firstName: string | null
  name: string
  bio: string | null
  contact: string | null
  avatarBg: string
  avatarFg: string
}

export function publicPreview(profile: {
  firstName: string | null
  name: string
  bio: string | null
  bioShared: boolean
  contact: string | null
  contactShared: boolean
  avatarBg: string
  avatarFg: string
}): PublicPreview {
  const filled = (value: string | null) => (value !== null && value.trim() !== '' ? value : null)
  return {
    firstName: profile.firstName,
    name: profile.name,
    bio: profile.bioShared ? filled(profile.bio) : null,
    contact: profile.contactShared ? filled(profile.contact) : null,
    // Les couleurs n'ont pas d'interrupteur : elles sont faites pour être vues.
    avatarBg: profile.avatarBg,
    avatarFg: profile.avatarFg,
  }
}
