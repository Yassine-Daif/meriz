import { describe, expect, it } from 'vitest'
import type { ApiClient, ApiResult, HttpMethod } from './apiClient'
import { apiError } from './apiClient'
import {
  canDeleteComment,
  commentCountLabel,
  createComment,
  deleteComment,
  formatCommentDate,
  listComments,
  parseComment,
  pinLabel,
  pinnedComments,
  reopenComment,
  resolveComment,
  sortedThread,
  unresolvedCount,
} from './commentsApi'
import type { Comment } from './commentsApi'

interface Sent {
  method: HttpMethod
  path: string
  body: unknown
}

function scriptedClient(responses: ApiResult[]) {
  const sent: Sent[] = []
  const client: ApiClient = {
    isConfigured: true,
    request: async (method, path, body) => {
      sent.push({ method, path, body })
      return responses.shift() ?? { ok: true, status: 200, data: null, body: null }
    },
    requestBlob: async () => ({ ok: false, error: apiError('unexpected', null, 'Binaire non simulé.') }),
  }
  return { client, sent }
}

const ok = (data: unknown): ApiResult => ({ ok: true, status: 200, data, body: { data } })

const profile = (id: number, name: string, firstName: string) => ({
  id,
  name,
  first_name: firstName,
  bio: null,
  contact: null,
  avatar_bg: '#1d4ed8',
  avatar_fg: '#ffffff',
})

const PROF = profile(1, 'Bernard', 'Claire')
const ELEVE = profile(3, 'Martin', 'Alice')

const serverComment = (overrides: Record<string, unknown> = {}) => ({
  id: '01K7COMMENT',
  document_id: '01K6DOC',
  body: 'Attention à la cardinalité.',
  position: null,
  resolved: false,
  resolved_at: null,
  resolver: null,
  author: PROF,
  created_at: '2026-10-08T09:28:06+00:00',
  updated_at: '2026-10-08T09:28:06+00:00',
  ...overrides,
})

const appComment = (overrides: Partial<Comment> = {}): Comment => ({
  id: 'c1',
  documentId: 'd1',
  body: 'Un mot.',
  position: null,
  resolved: false,
  resolvedAt: null,
  resolver: null,
  author: {
    id: 1,
    name: 'Bernard',
    firstName: 'Claire',
    bio: null,
    contact: null,
    avatarBg: '#1d4ed8',
    avatarFg: '#ffffff',
  },
  createdAt: '2026-10-08T09:00:00+00:00',
  updatedAt: '2026-10-08T09:00:00+00:00',
  ...overrides,
})

describe('commentsApi, lecture des réponses', () => {
  it('lit un commentaire général, sans bulle', () => {
    const comment = parseComment(serverComment())

    expect(comment?.position).toBeNull()
    expect(comment?.resolved).toBe(false)
    expect(comment?.author.firstName).toBe('Claire')
    expect(comment?.body).toBe('Attention à la cardinalité.')
  })

  it('lit une bulle et expose sa position', () => {
    const comment = parseComment(serverComment({ position: { x: 412.75, y: -88.5 } }))

    expect(comment?.position).toEqual({ x: 412.75, y: -88.5 })
  })

  it('lit un commentaire résolu, avec son résolveur', () => {
    const comment = parseComment(
      serverComment({ resolved: true, resolved_at: '2026-10-08T10:00:00+00:00', resolver: ELEVE }),
    )

    expect(comment?.resolved).toBe(true)
    expect(comment?.resolver?.name).toBe('Martin')
    expect(comment?.resolvedAt).toBe('2026-10-08T10:00:00+00:00')
  })

  it('lit un commentaire résolu dont le résolveur a disparu', () => {
    // Le compte a été supprimé : résolu reste vrai, sans résolveur.
    const comment = parseComment(serverComment({ resolved: true, resolved_at: '2026-10-08T10:00:00+00:00' }))

    expect(comment?.resolved).toBe(true)
    expect(comment?.resolver).toBeNull()
  })

  it('refuse une position à moitié écrite', () => {
    expect(parseComment(serverComment({ position: { x: 10 } }))).toBeNull()
    expect(parseComment(serverComment({ position: { y: 10 } }))).toBeNull()
  })

  it('refuse une coordonnée qui n’est pas un nombre fini', () => {
    expect(parseComment(serverComment({ position: { x: 'ici', y: 2 } }))).toBeNull()
    expect(parseComment(serverComment({ position: { x: 1, y: Number.POSITIVE_INFINITY } }))).toBeNull()
  })

  it('refuse une réponse sans identifiant, sans corps ou sans auteur', () => {
    expect(parseComment(serverComment({ id: 7 }))).toBeNull()
    expect(parseComment(serverComment({ body: null }))).toBeNull()
    expect(parseComment(serverComment({ author: undefined }))).toBeNull()
  })

  it('refuse un auteur ou un résolveur mal formé', () => {
    expect(parseComment(serverComment({ author: { id: 'pas un nombre' } }))).toBeNull()
    expect(parseComment(serverComment({ resolved: true, resolver: { name: 'sans identifiant' } }))).toBeNull()
  })
})

describe('commentsApi, le fil', () => {
  it('lit le fil tel que le serveur l’envoie', async () => {
    const { client, sent } = scriptedClient([
      ok([serverComment({ id: 'a' }), serverComment({ id: 'b', author: ELEVE })]),
    ])

    const result = await listComments(client, '01K6DOC')

    expect(result.ok && result.value.map((comment) => comment.id)).toEqual(['a', 'b'])
    expect(sent[0]).toEqual({ method: 'GET', path: '/documents/01K6DOC/comments', body: undefined })
  })

  it('invalide toute la liste dès qu’une ligne est illisible', async () => {
    const { client } = scriptedClient([ok([serverComment(), { id: 7 }])])

    const result = await listComments(client, 'd1')

    expect(result.ok ? null : result.error.kind).toBe('unexpected')
  })

  it('refuse une réponse qui n’est pas un tableau', async () => {
    const { client } = scriptedClient([ok(serverComment())])

    expect((await listComments(client, 'd1')).ok).toBe(false)
  })
})

describe('commentsApi, écriture', () => {
  it('écrit un commentaire général : le corps seul', async () => {
    const { client, sent } = scriptedClient([ok(serverComment())])

    await createComment(client, 'd1', { body: 'Bon travail.', position: null })

    expect(sent[0]?.body).toEqual({ body: 'Bon travail.' })
  })

  it('écrit une bulle avec ses deux coordonnées à plat', async () => {
    const { client, sent } = scriptedClient([ok(serverComment({ position: { x: 12, y: -4 } }))])

    const result = await createComment(client, 'd1', { body: 'Ici.', position: { x: 12, y: -4 } })

    expect(sent[0]).toEqual({
      method: 'POST',
      path: '/documents/d1/comments',
      body: { body: 'Ici.', position_x: 12, position_y: -4 },
    })
    expect(result.ok && result.value.position).toEqual({ x: 12, y: -4 })
  })

  it('n’envoie jamais une coordonnée nulle', async () => {
    const { client, sent } = scriptedClient([ok(serverComment())])

    await createComment(client, 'd1', { body: 'Général.', position: null })

    expect(sent[0]?.body).not.toHaveProperty('position_x')
    expect(sent[0]?.body).not.toHaveProperty('position_y')
  })

  it('résout, et rend le commentaire à jour', async () => {
    const { client, sent } = scriptedClient([
      ok(serverComment({ resolved: true, resolved_at: '2026-10-08T10:00:00+00:00', resolver: ELEVE })),
    ])

    const result = await resolveComment(client, 'c1')

    expect(sent[0]).toEqual({ method: 'POST', path: '/comments/c1/resolution', body: undefined })
    expect(result.ok && result.value.resolved).toBe(true)
  })

  it('rouvre, et la trace du résolveur disparaît', async () => {
    const { client, sent } = scriptedClient([ok(serverComment())])

    const result = await reopenComment(client, 'c1')

    expect(sent[0]).toEqual({ method: 'DELETE', path: '/comments/c1/resolution', body: undefined })
    expect(result.ok && result.value.resolved).toBe(false)
    expect(result.ok && result.value.resolver).toBeNull()
  })

  it('supprime, et rend un succès vide', async () => {
    const { client, sent } = scriptedClient([{ ok: true, status: 204, data: undefined, body: undefined }])

    expect(await deleteComment(client, 'c1')).toEqual({ ok: true, value: undefined })
    expect(sent[0]).toEqual({ method: 'DELETE', path: '/comments/c1', body: undefined })
  })

  it('rend le refus de suppression tel quel, la phrase du serveur comprise', async () => {
    const refus = "Seul l'auteur du commentaire ou le responsable du travail peut le supprimer."
    const { client } = scriptedClient([{ ok: false, error: apiError('forbidden', 403, refus) }])

    const result = await deleteComment(client, 'c1')

    expect(result.ok ? null : result.error.message).toBe(refus)
  })

  it('rend le dépassement de quota sur la clé body', async () => {
    const { client } = scriptedClient([
      {
        ok: false,
        error: {
          kind: 'validation',
          status: 422,
          message: 'Nombre maximal de commentaires atteint pour ce travail.',
          fieldErrors: { body: ['Nombre maximal de commentaires atteint pour ce travail.'] },
        },
      },
    ])

    const result = await createComment(client, 'd1', { body: 'Encore un.', position: null })

    expect(result.ok ? null : result.error.fieldErrors.body?.[0]).toContain('Nombre maximal')
  })

  it('échappe les identifiants dans les chemins', async () => {
    const { client, sent } = scriptedClient([ok([]), ok(serverComment())])

    await listComments(client, 'd/1')
    await resolveComment(client, 'c/1')

    expect(sent.map((call) => call.path)).toEqual(['/documents/d%2F1/comments', '/comments/c%2F1/resolution'])
  })
})

describe('commentsApi, affichage', () => {
  it('trie du plus ancien au plus récent, et garde l’ordre reçu à dates égales', () => {
    const recent = appComment({ id: 'recent', createdAt: '2026-10-08T12:00:00+00:00' })
    const ancien = appComment({ id: 'ancien', createdAt: '2026-10-08T08:00:00+00:00' })
    const jumeau = appComment({ id: 'jumeau', createdAt: '2026-10-08T08:00:00+00:00' })

    expect(sortedThread([recent, ancien, jumeau]).map((comment) => comment.id)).toEqual([
      'ancien',
      'jumeau',
      'recent',
    ])
  })

  it('compte ce qui reste à traiter, bulles et généraux mêlés', () => {
    const fil = [
      appComment({ id: '1' }),
      appComment({ id: '2', resolved: true }),
      appComment({ id: '3', position: { x: 1, y: 2 } }),
    ]

    expect(unresolvedCount(fil)).toBe(2)
    expect(pinnedComments(fil).map((comment) => comment.id)).toEqual(['3'])
  })

  it('écrit le compte en toutes lettres', () => {
    expect(commentCountLabel(0)).toBe('Aucun commentaire')
    expect(commentCountLabel(1)).toBe('1 commentaire')
    expect(commentCountLabel(4)).toBe('4 commentaires')
  })

  it('écrit la date, avec un repli si elle est illisible', () => {
    expect(formatCommentDate('2026-10-08T09:28:06+00:00')).toContain('2026')
    expect(formatCommentDate(null)).toBe('date inconnue')
    expect(formatCommentDate('pas une date')).toBe('date inconnue')
  })

  it('écrit l’étiquette d’une bulle : rang, auteur, état et extrait', () => {
    const label = pinLabel(appComment({ body: 'Revois la cardinalité.' }), 1)

    expect(label).toBe('Commentaire 2 de Claire Bernard : « Revois la cardinalité. »')
    expect(pinLabel(appComment({ resolved: true }), 0)).toContain(', résolu')
  })

  it('coupe un corps trop long dans l’étiquette', () => {
    const label = pinLabel(appComment({ body: 'a'.repeat(200) }), 0)

    expect(label).toContain('…')
    expect(label.length).toBeLessThan(140)
  })

  it('décide qui peut supprimer : l’auteur, le responsable, personne d’autre', () => {
    const mien = appComment({ author: { ...appComment().author, id: 3 } })

    expect(canDeleteComment(mien, 3, false)).toBe(true)
    expect(canDeleteComment(mien, 9, false)).toBe(false)
    expect(canDeleteComment(mien, 9, true)).toBe(true)
  })
})
