import { describe, expect, it } from 'vitest'
import type { ApiClient, ApiResult, HttpMethod } from './apiClient'
import { apiError } from './apiClient'
import {
  createLesson,
  deleteLesson,
  deleteLessonMedium,
  lessonStateLabel,
  listClassroomLessons,
  mediaCountLabel,
  mediumPath,
  parseLesson,
  parseLessonSummary,
  publishLesson,
  unpublishLesson,
  updateLesson,
  uploadLessonMedium,
} from './lessonsApi'

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
      return responses.shift() ?? { ok: true, status: 204, data: undefined, body: undefined }
    },
    requestBlob: async () => ({ ok: false, error: apiError('unexpected', null, 'Binaire non simulé.') }),
  }
  return { client, sent }
}

const ok = (data: unknown): ApiResult => ({ ok: true, status: 200, data, body: { data } })

const serverMedium = {
  id: '01MED',
  kind: 'image',
  mime: 'image/png',
  size: 2048,
  name: 'schema.png',
  url: 'http://127.0.0.1:8000/api/lessons/01LE/media/01MED',
  created_at: '2026-09-25T10:00:00+00:00',
}

/** Cours tel que le serveur le renvoie au prof, vue détaillée. */
const serverLesson = {
  id: '01LE',
  classroom_id: '01CL',
  title: 'Les cardinalités',
  status: 'draft',
  published_at: null,
  media_count: 1,
  blocks: '[{"type":"text","text":"Un livre a un auteur."}]',
  media: [serverMedium],
  created_at: '2026-09-25T09:00:00+00:00',
  updated_at: '2026-09-25T10:00:00+00:00',
}

describe('cours, lecture des réponses', () => {
  it('lit un cours complet, avec sa page et ses fichiers', () => {
    expect(parseLesson(serverLesson)).toMatchObject({
      id: '01LE',
      classroomId: '01CL',
      title: 'Les cardinalités',
      status: 'draft',
      publishedAt: null,
      mediaCount: 1,
      blocks: '[{"type":"text","text":"Un livre a un auteur."}]',
    })
    expect(parseLesson(serverLesson)?.media[0]).toEqual({
      id: '01MED',
      kind: 'image',
      mime: 'image/png',
      size: 2048,
      name: 'schema.png',
      createdAt: '2026-09-25T10:00:00+00:00',
    })
  })

  it('lit une ligne de liste, où le serveur n’envoie ni page ni fichiers', () => {
    const { blocks, media, ...listRow } = serverLesson
    void blocks
    void media

    expect(parseLessonSummary(listRow)).toMatchObject({ id: '01LE', mediaCount: 1, status: 'draft' })
    // Sans page, ce n'est pas un cours ouvrable : la lecture détaillée refuse.
    expect(parseLesson(listRow)).toBeNull()
  })

  it('tolère un cours sans fichier, et compte zéro par défaut', () => {
    const { media_count, media, ...nu } = serverLesson
    void media_count
    void media

    expect(parseLesson(nu)).toMatchObject({ mediaCount: 0, media: [] })
  })

  it('refuse une réponse mal formée', () => {
    expect(parseLesson({ ...serverLesson, status: 'archivé' })).toBeNull()
    expect(parseLesson({ ...serverLesson, blocks: 42 })).toBeNull()
    expect(parseLesson({ ...serverLesson, media: 'pas un tableau' })).toBeNull()
    expect(parseLesson({ ...serverLesson, media: [{ id: '01MED' }] })).toBeNull()
    expect(parseLesson({ ...serverLesson, media: [{ ...serverMedium, kind: 'video' }] })).toBeNull()
    expect(parseLessonSummary({ ...serverLesson, media_count: 'trois' })).toBeNull()
  })

  it('liste les cours d’une classe, et refuse une ligne mal formée', async () => {
    const good = scriptedClient([ok([serverLesson, { ...serverLesson, id: '01LF' }])])
    const bad = scriptedClient([ok([serverLesson, { id: '01LG' }])])

    const first = await listClassroomLessons(good.client, '01CL')
    const second = await listClassroomLessons(bad.client, '01CL')

    expect(good.sent[0]).toEqual({ method: 'GET', path: '/classrooms/01CL/lessons', body: undefined })
    expect(first.ok && first.value.map((lesson) => lesson.id)).toEqual(['01LE', '01LF'])
    expect(second.ok ? null : second.error.kind).toBe('unexpected')
  })
})

describe('cours, appels', () => {
  it('crée sur le chemin de la classe, page comprise', async () => {
    const { client, sent } = scriptedClient([ok(serverLesson)])

    await createLesson(client, '01CL', { title: 'Titre', blocks: '[]' })

    expect(sent[0]).toEqual({
      method: 'POST',
      path: '/classrooms/01CL/lessons',
      body: { title: 'Titre', blocks: '[]' },
    })
  })

  it("n'envoie que les champs fournis à la modification", async () => {
    const { client, sent } = scriptedClient([ok(serverLesson), ok(serverLesson)])

    await updateLesson(client, '01LE', { blocks: '[]' })
    await updateLesson(client, '01LE', { title: 'Autre', blocks: '[{"type":"text","text":"x"}]' })

    expect(sent[0]).toEqual({ method: 'PATCH', path: '/lessons/01LE', body: { blocks: '[]' } })
    expect(sent[1]?.body).toEqual({ title: 'Autre', blocks: '[{"type":"text","text":"x"}]' })
  })

  it('publie, dépublie et supprime sur les bons chemins', async () => {
    const { client, sent } = scriptedClient([ok(serverLesson), ok(serverLesson)])

    await publishLesson(client, '01LE')
    await unpublishLesson(client, '01LE')
    await deleteLesson(client, '01LE')

    expect(sent.map((call) => `${call.method} ${call.path}`)).toEqual([
      'POST /lessons/01LE/publication',
      'DELETE /lessons/01LE/publication',
      'DELETE /lessons/01LE',
    ])
  })

  it('envoie le fichier en multipart, sans le sérialiser', async () => {
    const { client, sent } = scriptedClient([ok(serverMedium)])
    const file = new File(['binaire'], 'schema.png', { type: 'image/png' })

    const outcome = await uploadLessonMedium(client, '01LE', file)

    const body = sent[0]?.body
    expect(sent[0]).toMatchObject({ method: 'POST', path: '/lessons/01LE/media' })
    expect(body).toBeInstanceOf(FormData)
    expect((body as FormData).get('file')).toBe(file)
    expect(outcome.ok && outcome.value.id).toBe('01MED')
  })

  it('supprime un fichier, et rend le refus du serveur tel quel', async () => {
    const error = apiError('forbidden', 403, 'Réservé au prof de la classe.')
    const { client, sent } = scriptedClient([{ ok: false, error }])

    const outcome = await deleteLessonMedium(client, '01LE', '01MED')

    expect(sent[0]).toMatchObject({ method: 'DELETE', path: '/lessons/01LE/media/01MED' })
    expect(outcome).toEqual({ ok: false, error })
  })

  it('échappe les identifiants dans les chemins', () => {
    expect(mediumPath('a/b', 'c d')).toBe('/lessons/a%2Fb/media/c%20d')
  })
})

describe('cours, affichage', () => {
  it('écrit l’état en toutes lettres', () => {
    const base = { id: '01LE', classroomId: '01CL', title: 'x', mediaCount: 0, createdAt: null, updatedAt: null }

    expect(lessonStateLabel({ ...base, status: 'draft', publishedAt: null })).toBe('Brouillon')
    expect(lessonStateLabel({ ...base, status: 'published', publishedAt: null })).toBe('Publié')
    expect(lessonStateLabel({ ...base, status: 'published', publishedAt: 'pas une date' })).toBe('Publié')
    expect(lessonStateLabel({ ...base, status: 'published', publishedAt: '2026-09-25T10:00:00+00:00' })).toContain(
      'Publié le',
    )
  })

  it('compte les fichiers au singulier et au pluriel', () => {
    expect(mediaCountLabel(0)).toBe('')
    expect(mediaCountLabel(1)).toBe('1 fichier')
    expect(mediaCountLabel(4)).toBe('4 fichiers')
  })
})
