import type { ApiClient, Outcome } from './apiClient'
import { unexpectedResponse } from './apiClient'

/**
 * Appels de compte : inscription, connexion, profil, déconnexion.
 * Chaque réponse est vérifiée avant usage : on ne fait jamais
 * confiance à la forme renvoyée par le réseau.
 */

export type UserRole = 'student' | 'teacher'

/** Utilisateur tel que l'application l'utilise. */
export interface ApiUser {
  id: number
  name: string
  email: string
  role: UserRole
  /** Adresse d'un établissement scolaire ou universitaire reconnu. */
  isAcademic: boolean
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
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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
  return {
    id: raw.id,
    name: raw.name,
    email: raw.email,
    role: raw.role,
    isAcademic: raw.is_academic,
  }
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
