import { translateValidationMessage } from './validationMessages'

/**
 * Client du serveur Meriz : le seul endroit de l'application qui
 * appelle le réseau. Il ajoute les entêtes (JSON, jeton Bearer),
 * déballe les réponses et transforme toute erreur en ApiError, avec
 * un message en français. Il ne lève jamais d'exception.
 */

export type ApiErrorKind =
  | 'not_configured'
  | 'network'
  | 'unauthorized'
  | 'forbidden'
  | 'validation'
  | 'rate_limited'
  | 'server'
  | 'unexpected'

export interface ApiError {
  kind: ApiErrorKind
  /** Statut HTTP, null quand aucune réponse n'a été reçue. */
  status: number | null
  message: string
  /** Erreurs de validation par champ, déjà traduites. */
  fieldErrors: Record<string, string[]>
  /** Secondes à attendre avant de réessayer (429). */
  retryAfter?: number
}

/** Réponse brute : le contenu n'est pas typé tant qu'il n'est pas vérifié. */
export type ApiResult = { ok: true; status: number; data: unknown } | { ok: false; error: ApiError }

/** Résultat vérifié d'un appel métier. */
export type Outcome<T> = { ok: true; value: T } | { ok: false; error: ApiError }

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface ApiClient {
  readonly isConfigured: boolean
  request: (method: HttpMethod, path: string, body?: unknown) => Promise<ApiResult>
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>

interface ApiClientOptions {
  /** Origine du serveur, sans /api. null : comptes indisponibles. */
  baseUrl: string | null
  getToken: () => string | null
  /** Appelé quand le serveur refuse le jeton envoyé (401). */
  onUnauthorized?: () => void
  fetchImpl?: FetchLike
  timeoutMs?: number
}

const MESSAGES = {
  notConfigured: "Les comptes ne sont pas disponibles : l'adresse du serveur n'est pas configurée.",
  network: 'Serveur injoignable. Vérifiez votre connexion internet, puis réessayez.',
  unauthorized: 'Votre session a expiré. Reconnectez-vous.',
  forbidden: "Cette action n'est pas autorisée.",
  validation: 'Vérifiez les informations saisies.',
  server: 'Le serveur a rencontré une erreur. Réessayez dans quelques instants.',
  unexpected: 'Réponse inattendue du serveur. Réessayez plus tard.',
}

export function apiError(kind: ApiErrorKind, status: number | null, message: string): ApiError {
  return { kind, status, message, fieldErrors: {} }
}

export function unexpectedResponse(status: number | null): ApiError {
  return apiError('unexpected', status, MESSAGES.unexpected)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Erreurs par champ au format Laravel, traduites. */
function readFieldErrors(payload: unknown): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {}
  if (!isRecord(payload) || !isRecord(payload.errors)) {
    return fieldErrors
  }
  for (const [field, messages] of Object.entries(payload.errors)) {
    if (Array.isArray(messages)) {
      const texts = messages.filter((m): m is string => typeof m === 'string')
      if (texts.length > 0) {
        fieldErrors[field] = texts.map((text) => translateValidationMessage(field, text))
      }
    }
  }
  return fieldErrors
}

function rateLimitMessage(seconds: number | undefined): string {
  return seconds !== undefined && seconds > 0
    ? `Trop de tentatives. Réessayez dans ${seconds} seconde${seconds > 1 ? 's' : ''}.`
    : 'Trop de tentatives. Réessayez dans un instant.'
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const fetchImpl: FetchLike = options.fetchImpl ?? ((input, init) => fetch(input, init))
  const timeoutMs = options.timeoutMs ?? 15_000

  const request: ApiClient['request'] = async (method, path, body) => {
    if (options.baseUrl === null) {
      return { ok: false, error: apiError('not_configured', null, MESSAGES.notConfigured) }
    }

    const headers: Record<string, string> = { Accept: 'application/json' }
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
    }
    const token = options.getToken()
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    // Délai maximal : au-delà, la requête est abandonnée comme un échec réseau.
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    let response: Response
    let text: string
    try {
      response = await fetchImpl(`${options.baseUrl}/api${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      })
      text = await response.text()
    } catch {
      return { ok: false, error: apiError('network', null, MESSAGES.network) }
    } finally {
      clearTimeout(timer)
    }

    const status = response.status
    let payload: unknown = undefined
    if (text.trim() !== '') {
      try {
        payload = JSON.parse(text)
      } catch {
        if (response.ok) {
          return { ok: false, error: unexpectedResponse(status) }
        }
      }
    }

    if (response.ok) {
      // Les ressources Laravel enveloppent la réponse dans « data ».
      const data = isRecord(payload) && 'data' in payload ? payload.data : payload
      return { ok: true, status, data }
    }

    const serverMessage =
      isRecord(payload) && typeof payload.message === 'string' ? payload.message : null

    if (status === 401) {
      if (token) {
        options.onUnauthorized?.()
      }
      return { ok: false, error: apiError('unauthorized', status, MESSAGES.unauthorized) }
    }
    if (status === 403) {
      return { ok: false, error: apiError('forbidden', status, serverMessage ?? MESSAGES.forbidden) }
    }
    if (status === 422) {
      const fieldErrors = readFieldErrors(payload)
      const message =
        Object.keys(fieldErrors).length > 0
          ? MESSAGES.validation
          : serverMessage
            ? translateValidationMessage('', serverMessage)
            : MESSAGES.validation
      return { ok: false, error: { kind: 'validation', status, message, fieldErrors } }
    }
    if (status === 429) {
      const retryHeader = Number.parseInt(response.headers.get('Retry-After') ?? '', 10)
      const retryAfter = Number.isFinite(retryHeader) ? retryHeader : undefined
      return {
        ok: false,
        error: { ...apiError('rate_limited', status, rateLimitMessage(retryAfter)), retryAfter },
      }
    }
    if (status >= 500) {
      return { ok: false, error: apiError('server', status, MESSAGES.server) }
    }
    return { ok: false, error: unexpectedResponse(status) }
  }

  return { isConfigured: options.baseUrl !== null, request }
}
