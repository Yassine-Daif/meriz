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
  | 'not_found'
  | 'validation'
  | 'rate_limited'
  | 'server'
  | 'unexpected'
  /** Stockage du navigateur plein ou indisponible (hors réseau). */
  | 'storage'

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

/**
 * Réponse brute : le contenu n'est pas typé tant qu'il n'est pas vérifié.
 * `data` est la réponse déballée, `body` la réponse entière (pagination).
 */
export type ApiResult =
  | { ok: true; status: number; data: unknown; body: unknown }
  | { ok: false; error: ApiError }

/** Résultat vérifié d'un appel métier. */
export type Outcome<T> = { ok: true; value: T } | { ok: false; error: ApiError }

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface ApiClient {
  readonly isConfigured: boolean
  /**
   * Appel JSON. Un FormData part tel quel, en multipart : le navigateur
   * écrit lui-même la frontière, donc on ne pose pas Content-Type.
   */
  request: (method: HttpMethod, path: string, body?: unknown) => Promise<ApiResult>
  /** Lecture d'une réponse binaire (l'image d'un devoir, servie par jeton). */
  requestBlob: (path: string) => Promise<Outcome<Blob>>
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
  notFound: 'Document introuvable. Il a peut-être été supprimé.',
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

  /**
   * Envoi commun : adresse, jeton, délai maximal. Le corps de la réponse
   * est lu ici, tant que le délai court, en texte ou en binaire.
   */
  const send = async (
    method: HttpMethod,
    path: string,
    body: unknown,
    want: 'text' | 'blob',
  ): Promise<{ ok: true; response: Response; text: string; blob: Blob | null } | { ok: false; error: ApiError }> => {
    if (options.baseUrl === null) {
      return { ok: false, error: apiError('not_configured', null, MESSAGES.notConfigured) }
    }

    const multipart = typeof FormData !== 'undefined' && body instanceof FormData
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (body !== undefined && !multipart) {
      headers['Content-Type'] = 'application/json'
    }
    const token = options.getToken()
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    // Délai maximal : au-delà, la requête est abandonnée comme un échec réseau.
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetchImpl(`${options.baseUrl}/api${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : multipart ? (body as FormData) : JSON.stringify(body),
        signal: controller.signal,
      })
      // Une erreur se lit toujours en texte : le serveur répond en JSON.
      const binary = want === 'blob' && response.ok
      const blob = binary ? await response.blob() : null
      const text = binary ? '' : await response.text()
      return { ok: true, response, text, blob }
    } catch {
      return { ok: false, error: apiError('network', null, MESSAGES.network) }
    } finally {
      clearTimeout(timer)
    }
  }

  /** Traduit une réponse en échec. Le corps sert à lire le message du serveur. */
  const failure = (response: Response, text: string): ApiError => {
    const status = response.status
    let payload: unknown = undefined
    if (text.trim() !== '') {
      try {
        payload = JSON.parse(text)
      } catch {
        // Corps illisible : le statut suffit à choisir le message.
        payload = undefined
      }
    }
    const serverMessage =
      isRecord(payload) && typeof payload.message === 'string' ? payload.message : null

    if (status === 401) {
      if (options.getToken()) {
        options.onUnauthorized?.()
      }
      return apiError('unauthorized', status, MESSAGES.unauthorized)
    }
    if (status === 403) {
      return apiError('forbidden', status, serverMessage ?? MESSAGES.forbidden)
    }
    if (status === 404) {
      // Le serveur ne distingue pas « inexistant » de « appartient à un autre ».
      return apiError('not_found', status, MESSAGES.notFound)
    }
    if (status === 422) {
      const fieldErrors = readFieldErrors(payload)
      const message =
        Object.keys(fieldErrors).length > 0
          ? MESSAGES.validation
          : serverMessage
            ? translateValidationMessage('', serverMessage)
            : MESSAGES.validation
      return { kind: 'validation', status, message, fieldErrors }
    }
    if (status === 429) {
      const retryHeader = Number.parseInt(response.headers.get('Retry-After') ?? '', 10)
      const retryAfter = Number.isFinite(retryHeader) ? retryHeader : undefined
      return { ...apiError('rate_limited', status, rateLimitMessage(retryAfter)), retryAfter }
    }
    if (status >= 500) {
      return apiError('server', status, MESSAGES.server)
    }
    return unexpectedResponse(status)
  }

  const request: ApiClient['request'] = async (method, path, body) => {
    const sent = await send(method, path, body, 'text')
    if (!sent.ok) {
      return sent
    }
    const { response, text } = sent
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
      return { ok: true, status, data, body: payload }
    }
    return { ok: false, error: failure(response, text) }
  }

  const requestBlob: ApiClient['requestBlob'] = async (path) => {
    const sent = await send('GET', path, undefined, 'blob')
    if (!sent.ok) {
      return sent
    }
    if (!sent.response.ok || sent.blob === null) {
      return { ok: false, error: failure(sent.response, sent.text) }
    }
    return { ok: true, value: sent.blob }
  }
  return { isConfigured: options.baseUrl !== null, request, requestBlob }
}
