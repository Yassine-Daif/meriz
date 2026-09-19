import type { ApiClient, Outcome } from './apiClient'
import { DEFAULT_AVATAR_BG, DEFAULT_AVATAR_FG, parseAvatarColor } from './color'
import { unexpectedResponse } from './apiClient'

/**
 * Appels de compte : inscription, connexion, profil, déconnexion.
 * Chaque réponse est vérifiée avant usage : on ne fait jamais
 * confiance à la forme renvoyée par le réseau.
 */

export type UserRole = 'student' | 'teacher'

/**
 * Mon propre compte, tel que l'application l'utilise. C'est la seule
 * donnée qui contient l'email de connexion : il n'est jamais montré aux
 * autres (voir le profil public des classes).
 */
export interface ApiUser {
  id: number
  /** Nom de famille. */
  name: string
  /** Prénom : peut manquer pour un compte créé avant qu'il soit demandé. */
  firstName: string | null
  email: string
  role: UserRole
  /** Adresse d'un établissement scolaire ou universitaire reconnu. */
  isAcademic: boolean
  bio: string | null
  bioShared: boolean
  contact: string | null
  contactShared: boolean
  /** Couleurs de la pastille d'initiales, hexadécimales. */
  avatarBg: string
  avatarFg: string
}

export interface AuthSuccess {
  user: ApiUser
  token: string
}

export interface Credentials {
  email: string
  password: string
}

/** Inscription neutre : aucun rôle n'est demandé ni envoyé. */
export interface SignUpData extends Credentials {
  name: string
  firstName: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Champ texte facultatif : absent ou nul donne null, une chaîne passe,
 * tout autre type rend la réponse invalide (undefined).
 */
export function optionalText(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null
  return typeof value === 'string' ? value : undefined
}

/** Booléen facultatif : absent donne false, un autre type est invalide. */
function optionalFlag(value: unknown): boolean | undefined {
  if (value === undefined || value === null) return false
  return typeof value === 'boolean' ? value : undefined
}

/** Utilisateur lu dans une réponse du serveur, ou null si mal formé. */
export function parseApiUser(raw: unknown): ApiUser | null {
  if (
    !isRecord(raw) ||
    typeof raw.id !== 'number' ||
    typeof raw.name !== 'string' ||
    typeof raw.email !== 'string' ||
    (raw.role !== 'student' && raw.role !== 'teacher') ||
    typeof raw.is_academic !== 'boolean'
  ) {
    return null
  }
  const firstName = optionalText(raw.first_name)
  const bio = optionalText(raw.bio)
  const contact = optionalText(raw.contact)
  const bioShared = optionalFlag(raw.bio_shared)
  const contactShared = optionalFlag(raw.contact_shared)
  if (
    firstName === undefined ||
    bio === undefined ||
    contact === undefined ||
    bioShared === undefined ||
    contactShared === undefined
  ) {
    return null
  }
  return {
    id: raw.id,
    name: raw.name,
    firstName,
    email: raw.email,
    role: raw.role,
    isAcademic: raw.is_academic,
    bio,
    bioShared,
    contact,
    contactShared,
    avatarBg: parseAvatarColor(raw.avatar_bg, DEFAULT_AVATAR_BG),
    avatarFg: parseAvatarColor(raw.avatar_fg, DEFAULT_AVATAR_FG),
  }
}

/** « Prénom Nom », ou le nom seul si le prénom manque. */
export function displayName(person: { firstName: string | null; name: string }): string {
  return [person.firstName, person.name].filter((part) => part && part.trim() !== '').join(' ')
}

function parseAuthSuccess(raw: unknown): AuthSuccess | null {
  if (!isRecord(raw) || typeof raw.token !== 'string' || raw.token === '') {
    return null
  }
  const user = parseApiUser(raw.user)
  return user ? { user, token: raw.token } : null
}

/** Nom de l'appareil associé au jeton, visible dans la liste des sessions. */
export function deviceName(): string {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
    ? 'Meriz bureau'
    : 'Meriz web'
}

async function authenticate(
  client: ApiClient,
  path: string,
  body: Record<string, string>,
): Promise<Outcome<AuthSuccess>> {
  const result = await client.request('POST', path, { ...body, device_name: deviceName() })
  if (!result.ok) {
    return result
  }
  const success = parseAuthSuccess(result.data)
  return success ? { ok: true, value: success } : { ok: false, error: unexpectedResponse(result.status) }
}

export function register(client: ApiClient, data: SignUpData): Promise<Outcome<AuthSuccess>> {
  return authenticate(client, '/auth/register', {
    name: data.name,
    first_name: data.firstName,
    email: data.email,
    password: data.password,
  })
}

export function login(client: ApiClient, credentials: Credentials): Promise<Outcome<AuthSuccess>> {
  return authenticate(client, '/auth/login', {
    email: credentials.email,
    password: credentials.password,
  })
}

export async function fetchCurrentUser(client: ApiClient): Promise<Outcome<ApiUser>> {
  const result = await client.request('GET', '/me')
  if (!result.ok) {
    return result
  }
  const user = parseApiUser(result.data)
  return user ? { ok: true, value: user } : { ok: false, error: unexpectedResponse(result.status) }
}

/** Révoque le jeton courant côté serveur. */
export async function logout(client: ApiClient): Promise<Outcome<void>> {
  const result = await client.request('POST', '/auth/logout')
  return result.ok ? { ok: true, value: undefined } : result
}
