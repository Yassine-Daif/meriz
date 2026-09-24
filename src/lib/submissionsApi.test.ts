import { describe, expect, it } from 'vitest'
import type { ApiClient, ApiResult, HttpMethod } from './apiClient'
import { apiError } from './apiClient'
import {
  formatSubmittedAt,
  getMySubmission,
  getSubmission,
  gradeSubmission,
  listAssignmentSubmissions,
  parseSubmission,
  parseSubmissionSummary,
  removeGrade,
  submitWork,
  workState,
  workStateLabel,
} from './submissionsApi'

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
      return responses.shift() ?? { ok: true, status: 200, data: undefined, body: undefined }
    },
    requestBlob: async () => ({ ok: false, error: apiError('unexpected', null, 'Binaire non simulé.') }),
  }
  return { client, sent }
}

const ok = (data: unknown): ApiResult => ({ ok: true, status: 200, data, body: { data } })

const student = {
  id: 12,
  name: 'Roy',
  first_name: 'Camille',
  bio: null,
  contact: null,
  avatar_bg: '#e0e7ff',
  avatar_fg: '#1e1b4b',
}

/** Rendu tel que le serveur le renvoie, vue détaillée. */
const serverSubmission = {
  id: '01SB',
  assignment_id: '01JB',
  student,
  status: 'submitted',
  submitted_at: '2026-10-02T08:00:00+00:00',
  is_late: true,
  grade: null,
  feedback: null,
  graded_at: null,
  content: '{"format":"meriz-mcd"}',
  created_at: '2026-10-02T08:00:00+00:00',
  updated_at: '2026-10-02T08:00:00+00:00',
}

describe('rendus, lecture des réponses', () => {
  it('lit un rendu complet, contenu compris', () => {
    expect(parseSubmission(serverSubmission)).toMatchObject({
      id: '01SB',
      assignmentId: '01JB',
      status: 'submitted',
      isLate: true,
      grade: null,
      feedback: null,
      content: '{"format":"meriz-mcd"}',
    })
    expect(parseSubmission(serverSubmission)?.student.firstName).toBe('Camille')
  })

  it("lit une ligne de liste, où le serveur n'envoie pas le contenu", () => {
    const { content, ...listRow } = serverSubmission
    void content

    expect(parseSubmissionSummary(listRow)).toMatchObject({ id: '01SB', status: 'submitted' })
    // Sans contenu, ce n'est pas un rendu ouvrable : la lecture détaillée refuse.
    expect(parseSubmission(listRow)).toBeNull()
  })

  it('lit une note et son commentaire', () => {
    const graded = {
      ...serverSubmission,
      status: 'graded',
      grade: '16/20',
      feedback: 'Bon découpage.',
      graded_at: '2026-10-03T09:00:00+00:00',
    }

    expect(parseSubmission(graded)).toMatchObject({
      status: 'graded',
      grade: '16/20',
      feedback: 'Bon découpage.',
      gradedAt: '2026-10-03T09:00:00+00:00',
    })
  })

  it('refuse une réponse mal formée', () => {
    expect(parseSubmission({ ...serverSubmission, status: 'rendu' })).toBeNull()
    expect(parseSubmission({ ...serverSubmission, student: undefined })).toBeNull()
    expect(parseSubmission({ ...serverSubmission, grade: 42 })).toBeNull()
    expect(parseSubmission({ ...serverSubmission, assignment_id: 7 })).toBeNull()
  })

  it('liste les rendus d’un devoir, et refuse une ligne mal formée', async () => {
    const good = scriptedClient([ok([serverSubmission, { ...serverSubmission, id: '01SC' }])])
    const bad = scriptedClient([ok([serverSubmission, { id: '01SD' }])])

    const first = await listAssignmentSubmissions(good.client, '01JB')
    const second = await listAssignmentSubmissions(bad.client, '01JB')

    expect(good.sent[0]).toEqual({ method: 'GET', path: '/assignments/01JB/submissions', body: undefined })
    expect(first.ok && first.value.map((s) => s.id)).toEqual(['01SB', '01SC'])
    expect(second.ok ? null : second.error.kind).toBe('unexpected')
  })
})

describe('rendus, appels', () => {
  it('dépose le travail en PUT, avec le contenu tel quel', async () => {
    const { client, sent } = scriptedClient([ok(serverSubmission)])

    await submitWork(client, '01JB', '{"format":"meriz-mcd"}')

    expect(sent[0]).toEqual({
      method: 'PUT',
      path: '/assignments/01JB/submission',
      body: { content: '{"format":"meriz-mcd"}' },
    })
  })

  it('lit mon rendu, et rend « introuvable » tel quel pour dire « rien rendu »', async () => {
    const absent = apiError('not_found', 404, 'Ressource introuvable.')
    const { client, sent } = scriptedClient([{ ok: false, error: absent }])

    const outcome = await getMySubmission(client, '01JB')

    expect(sent[0]).toEqual({ method: 'GET', path: '/assignments/01JB/submission', body: undefined })
    expect(outcome).toEqual({ ok: false, error: absent })
  })

  it('ouvre un rendu par son identifiant', async () => {
    const { client, sent } = scriptedClient([ok(serverSubmission)])

    const outcome = await getSubmission(client, '01SB')

    expect(sent[0]).toEqual({ method: 'GET', path: '/submissions/01SB', body: undefined })
    expect(outcome.ok && outcome.value.content).toBe('{"format":"meriz-mcd"}')
  })

  it('note en envoyant toujours les deux champs, commentaire vide compris', async () => {
    const { client, sent } = scriptedClient([ok(serverSubmission), ok(serverSubmission)])

    await gradeSubmission(client, '01SB', { grade: '16/20', feedback: 'Bien vu.' })
    await gradeSubmission(client, '01SB', { grade: 'Acquis', feedback: null })

    expect(sent[0]).toEqual({
      method: 'POST',
      path: '/submissions/01SB/grade',
      body: { grade: '16/20', feedback: 'Bien vu.' },
    })
    expect(sent[1]?.body).toEqual({ grade: 'Acquis', feedback: null })
  })

  it('retire la note sur son chemin, et rend le refus du serveur tel quel', async () => {
    const error = apiError('forbidden', 403, 'Réservé au prof du devoir.')
    const { client, sent } = scriptedClient([{ ok: false, error }])

    const outcome = await removeGrade(client, '01SB')

    expect(sent[0]).toMatchObject({ method: 'DELETE', path: '/submissions/01SB/grade' })
    expect(outcome).toEqual({ ok: false, error })
  })

  it('échappe les identifiants dans les chemins', async () => {
    const { client, sent } = scriptedClient([ok(serverSubmission)])

    await getSubmission(client, 'a/b')

    expect(sent[0]?.path).toBe('/submissions/a%2Fb')
  })
})

describe('rendus, affichage', () => {
  it('écrit la date de dépôt, avec un repli si elle est illisible', () => {
    expect(formatSubmittedAt('2026-10-02T08:00:00+00:00')).toContain('Rendu le')
    expect(formatSubmittedAt(null)).toBe('Date de dépôt inconnue')
    expect(formatSubmittedAt('pas une date')).toBe('Date de dépôt inconnue')
  })

  it('dérive l’avancement : le serveur d’abord, le navigateur ensuite', () => {
    const submitted = parseSubmissionSummary(serverSubmission)
    const graded = parseSubmissionSummary({ ...serverSubmission, status: 'graded', grade: '16/20' })

    expect(workState(graded, false)).toBe('graded')
    expect(workState(submitted, true)).toBe('submitted')
    expect(workState(null, true)).toBe('started')
    expect(workState(null, false)).toBe('todo')
  })

  it('écrit chaque avancement en toutes lettres', () => {
    expect(workStateLabel('todo')).toBe('À faire')
    expect(workStateLabel('started')).toBe('En cours')
    expect(workStateLabel('submitted')).toBe('Rendu')
    expect(workStateLabel('graded')).toBe('Noté')
  })
})
