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
}

export async function updateProfile(client: ApiClient, patch: ProfilePatch): Promise<Outcome<ApiUser>> {
  const body: Record<string, string | boolean | null> = {}
  if (patch.name !== undefined) body.name = patch.name
  if (patch.firstName !== undefined) body.first_name = patch.firstName
  if (patch.bio !== undefined) body.bio = patch.bio
  if (patch.bioShared !== undefined) body.bio_shared = patch.bioShared
  if (patch.contact !== undefined) body.contact = patch.contact
  if (patch.contactShared !== undefined) body.contact_shared = patch.contactShared

  const result = await client.request('PATCH', '/me', body)
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
}

export function publicPreview(profile: {
  firstName: string | null
  name: string
  bio: string | null
  bioShared: boolean
  contact: string | null
  contactShared: boolean
}): PublicPreview {
  const filled = (value: string | null) => (value !== null && value.trim() !== '' ? value : null)
  return {
    firstName: profile.firstName,
    name: profile.name,
    bio: profile.bioShared ? filled(profile.bio) : null,
    contact: profile.contactShared ? filled(profile.contact) : null,
  }
}
