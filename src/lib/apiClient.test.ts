import { describe, expect, it, vi } from 'vitest'
import { createApiClient } from './apiClient'

interface Call {
  url: string
  init: RequestInit
}

/** fetch simulé : enregistre les appels et renvoie la réponse fournie. */
function fakeFetch(respond: () => Response | Promise<Response>) {
  const calls: Call[] = []
  const impl = async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return respond()
  }
  return { impl, calls }
}

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

function headersOf(call: Call | undefined): Record<string, string> {
  return (call?.init.headers ?? {}) as Record<string, string>
}

const BASE = 'http://127.0.0.1:8000'

describe('apiClient, requêtes', () => {
  it("construit l'adresse sous /api et envoie Accept JSON", async () => {
    const { impl, calls } = fakeFetch(() => jsonResponse(200, { status: 'ok' }))
    const client = createApiClient({ baseUrl: BASE, getToken: () => null, fetchImpl: impl })

    await client.request('GET', '/health')

    expect(calls[0]?.url).toBe('http://127.0.0.1:8000/api/health')
    expect(calls[0]?.init.method).toBe('GET')
    expect(headersOf(calls[0])).toEqual({ Accept: 'application/json' })
    expect(calls[0]?.init.body).toBeUndefined()
  })

  it('ajoute le jeton Bearer quand il existe, et le corps JSON quand il y en a un', async () => {
    const { impl, calls } = fakeFetch(() => jsonResponse(200, {}))
    const client = createApiClient({ baseUrl: BASE, getToken: () => 'abc|123', fetchImpl: impl })

    await client.request('POST', '/auth/logout', { a: 1 })

    expect(headersOf(calls[0])).toEqual({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: 'Bearer abc|123',
    })
    expect(calls[0]?.init.body).toBe('{"a":1}')
  })

  it("n'appelle pas le réseau quand l'adresse n'est pas configurée", async () => {
    const { impl, calls } = fakeFetch(() => jsonResponse(200, {}))
    const client = createApiClient({ baseUrl: null, getToken: () => 'jeton', fetchImpl: impl })

    const result = await client.request('GET', '/me')

    expect(client.isConfigured).toBe(false)
    expect(calls).toHaveLength(0)
    expect(result.ok ? null : result.error.kind).toBe('not_configured')
  })
})

describe('apiClient, réponses réussies', () => {
  it("déballe l'enveloppe data des ressources Laravel", async () => {
    const { impl } = fakeFetch(() => jsonResponse(200, { data: { id: 7 } }))
    const client = createApiClient({ baseUrl: BASE, getToken: () => null, fetchImpl: impl })

    expect(await client.request('GET', '/me')).toEqual({ ok: true, status: 200, data: { id: 7 }, body: { data: { id: 7 } } })
  })

  it('renvoie la réponse telle quelle sans enveloppe, et undefined pour un 204', async () => {
    const plain = fakeFetch(() => jsonResponse(200, { status: 'ok' }))
    const empty = fakeFetch(() => new Response(null, { status: 204 }))

    const plainResult = await createApiClient({ baseUrl: BASE, getToken: () => null, fetchImpl: plain.impl }).request('GET', '/health')
    const emptyResult = await createApiClient({ baseUrl: BASE, getToken: () => 't', fetchImpl: empty.impl }).request('POST', '/auth/logout')

    expect(plainResult).toEqual({ ok: true, status: 200, data: { status: 'ok' }, body: { status: 'ok' } })
    expect(emptyResult).toEqual({ ok: true, status: 204, data: undefined, body: undefined })
  })

  it('traite un succès au JSON illisible comme une réponse inattendue', async () => {
    const { impl } = fakeFetch(() => new Response('<html>oups</html>', { status: 200 }))
    const result = await createApiClient({ baseUrl: BASE, getToken: () => null, fetchImpl: impl }).request('GET', '/me')

    expect(result.ok ? null : result.error.kind).toBe('unexpected')
  })
})

describe('apiClient, erreurs', () => {
  it('422 : erreurs par champ traduites et message général', async () => {
    const { impl } = fakeFetch(() =>
      jsonResponse(422, {
        message: 'The email has already been taken.',
        errors: {
          email: ['The email has already been taken.'],
          password: ['The password field must be at least 8 characters.'],
        },
      }),
    )
    const result = await createApiClient({ baseUrl: BASE, getToken: () => null, fetchImpl: impl }).request('POST', '/auth/register', {})

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.kind).toBe('validation')
      expect(result.error.status).toBe(422)
      expect(result.error.message).toBe('Vérifiez les informations saisies.')
      expect(result.error.fieldErrors).toEqual({
        email: ['Un compte existe déjà avec cette adresse email.'],
        password: ['8 caractères minimum.'],
      })
    }
  })

  it('401 avec jeton : prévient la session, qui pourra se nettoyer', async () => {
    const onUnauthorized = vi.fn()
    const { impl } = fakeFetch(() => jsonResponse(401, { message: 'Unauthenticated.' }))
    const result = await createApiClient({ baseUrl: BASE, getToken: () => 'périmé', onUnauthorized, fetchImpl: impl }).request('GET', '/me')

    expect(result.ok ? null : result.error.kind).toBe('unauthorized')
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  it('401 sans jeton : aucune session à nettoyer', async () => {
    const onUnauthorized = vi.fn()
    const { impl } = fakeFetch(() => jsonResponse(401, { message: 'Unauthenticated.' }))
    await createApiClient({ baseUrl: BASE, getToken: () => null, onUnauthorized, fetchImpl: impl }).request('GET', '/me')

    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('403 : garde le message du serveur', async () => {
    const { impl } = fakeFetch(() => jsonResponse(403, { message: 'Adresse non scolaire.' }))
    const result = await createApiClient({ baseUrl: BASE, getToken: () => 't', fetchImpl: impl }).request('POST', '/me/teacher-role')

    expect(result.ok ? null : result.error).toMatchObject({ kind: 'forbidden', message: 'Adresse non scolaire.' })
  })

  it('429 : lit le délai Retry-After et le dit en français', async () => {
    const { impl } = fakeFetch(() => jsonResponse(429, { message: 'Too Many Attempts.' }, { 'Retry-After': '42' }))
    const result = await createApiClient({ baseUrl: BASE, getToken: () => null, fetchImpl: impl }).request('POST', '/auth/login', {})

    expect(result.ok ? null : result.error).toMatchObject({
      kind: 'rate_limited',
      retryAfter: 42,
      message: 'Trop de tentatives. Réessayez dans 42 secondes.',
    })
  })

  it('500 : erreur serveur, même sans corps lisible', async () => {
    const { impl } = fakeFetch(() => new Response('Internal Server Error', { status: 500 }))
    const result = await createApiClient({ baseUrl: BASE, getToken: () => null, fetchImpl: impl }).request('GET', '/me')

    expect(result.ok ? null : result.error.kind).toBe('server')
  })

  it('serveur injoignable : erreur réseau, sans exception', async () => {
    const impl = async () => {
      throw new TypeError('Failed to fetch')
    }
    const result = await createApiClient({ baseUrl: BASE, getToken: () => null, fetchImpl: impl }).request('GET', '/me')

    expect(result.ok ? null : result.error).toMatchObject({ kind: 'network', status: null })
  })

  it('délai dépassé : la requête est abandonnée comme une erreur réseau', async () => {
    const impl = (_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      })
    const result = await createApiClient({ baseUrl: BASE, getToken: () => null, fetchImpl: impl, timeoutMs: 10 }).request('GET', '/me')

    expect(result.ok ? null : result.error.kind).toBe('network')
  })

  it("404 : document introuvable, sans distinguer un document d'un autre compte", async () => {
    const { impl } = fakeFetch(() => jsonResponse(404, { message: 'Ressource introuvable.' }))
    const result = await createApiClient({ baseUrl: BASE, getToken: () => 't', fetchImpl: impl }).request('GET', '/documents/x')

    expect(result.ok ? null : result.error).toMatchObject({ kind: 'not_found', status: 404 })
  })

  it('statut imprévu : réponse inattendue', async () => {
    const { impl } = fakeFetch(() => jsonResponse(418, { message: 'Teapot' }))
    const result = await createApiClient({ baseUrl: BASE, getToken: () => null, fetchImpl: impl }).request('GET', '/inconnu')

    expect(result.ok ? null : result.error.kind).toBe('unexpected')
  })
})

describe('apiClient, multipart et binaire', () => {
  it('envoie un FormData tel quel, sans Content-Type', async () => {
    const { impl, calls } = fakeFetch(() => jsonResponse(200, { data: { id: '01JB' } }))
    const client = createApiClient({ baseUrl: BASE, getToken: () => 'jeton', fetchImpl: impl })
    const form = new FormData()
    form.append('image', new File(['binaire'], 'schema.png', { type: 'image/png' }))

    await client.request('POST', '/assignments/01JB/image', form)

    expect(calls[0]?.init.body).toBe(form)
    expect(headersOf(calls[0])['Content-Type']).toBeUndefined()
    expect(headersOf(calls[0]).Authorization).toBe('Bearer jeton')
  })

  it('lit une réponse binaire', async () => {
    const { impl, calls } = fakeFetch(
      () => new Response(new Blob(['image'], { type: 'image/png' }), { status: 200 }),
    )
    const client = createApiClient({ baseUrl: BASE, getToken: () => 'jeton', fetchImpl: impl })

    const outcome = await client.requestBlob('/assignments/01JB/image')

    expect(calls[0]?.url).toBe('http://127.0.0.1:8000/api/assignments/01JB/image')
    expect(outcome.ok && outcome.value.type).toBe('image/png')
    expect(outcome.ok && (await outcome.value.text())).toBe('image')
  })

  it('traduit une erreur reçue à la place du binaire', async () => {
    const { impl } = fakeFetch(() => jsonResponse(404, { message: 'Ressource introuvable.' }))
    const client = createApiClient({ baseUrl: BASE, getToken: () => 'jeton', fetchImpl: impl })

    const outcome = await client.requestBlob('/assignments/01JB/image')

    expect(outcome.ok ? null : outcome.error.kind).toBe('not_found')
  })

  it('ne lit aucun binaire quand le serveur n’est pas configuré', async () => {
    const { impl, calls } = fakeFetch(() => jsonResponse(200, {}))
    const client = createApiClient({ baseUrl: null, getToken: () => null, fetchImpl: impl })

    const outcome = await client.requestBlob('/assignments/01JB/image')

    expect(calls).toHaveLength(0)
    expect(outcome.ok ? null : outcome.error.kind).toBe('not_configured')
  })
})