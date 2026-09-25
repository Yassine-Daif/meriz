import { describe, expect, it } from 'vitest'
import type { ApiClient, ApiResult, HttpMethod } from './apiClient'
import { apiError } from './apiClient'
import {
  listMyAssignments,
  listToGrade,
  pageCountLabel,
  parseStudentAssignmentRow,
  parseToGradeRow,
} from './overviewApi'

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

/** Réponse paginée, telle que le serveur l'enveloppe. */
const page = (data: unknown[], meta: Record<string, number>): ApiResult => ({
  ok: true,
  status: 200,
  data,
  body: { data, meta },
})

const student = {
  id: 12,
  name: 'Roy',
  first_name: 'Camille',
  bio: null,
  contact: null,
  avatar_bg: '#e0e7ff',
  avatar_fg: '#1e1b4b',
}

/** Ligne de la file à corriger, telle que le serveur la renvoie. */
const serverToGrade = {
  submission_id: '01SB',
  submitted_at: '2026-10-02T08:00:00+00:00',
  is_late: true,
  student,
  assignment: {
    id: '01JB',
    title: 'La bibliothèque',
    type: 'exercise',
    due_at: '2026-10-01T18:00:00+00:00',
  },
  classroom: { id: '01CL', name: 'BUT2 MMI' },
}

/** Devoir d'élève, vue d'ensemble. */
const serverAssignment = {
  id: '01JB',
  title: 'La bibliothèque',
  type: 'exercise',
  due_at: '2026-10-01T18:00:00+00:00',
  is_overdue: false,
  classroom: { id: '01CL', name: 'BUT2 MMI' },
  has_base: true,
  has_image: false,
  state: 'todo',
  document_id: null,
  submission: null,
}

describe('vues d’ensemble, lecture des réponses', () => {
  it('lit une ligne à corriger', () => {
    expect(parseToGradeRow(serverToGrade)).toEqual({
      submissionId: '01SB',
      submittedAt: '2026-10-02T08:00:00+00:00',
      isLate: true,
      student: {
        id: 12,
        name: 'Roy',
        firstName: 'Camille',
        bio: null,
        contact: null,
        avatarBg: '#e0e7ff',
        avatarFg: '#1e1b4b',
      },
      assignment: {
        id: '01JB',
        title: 'La bibliothèque',
        type: 'exercise',
        dueAt: '2026-10-01T18:00:00+00:00',
      },
      classroom: { id: '01CL', name: 'BUT2 MMI' },
    })
  })

  it('refuse une ligne à corriger sans classe, sans devoir ou sans élève', () => {
    expect(parseToGradeRow({ ...serverToGrade, classroom: null })).toBeNull()
    expect(parseToGradeRow({ ...serverToGrade, assignment: null })).toBeNull()
    expect(parseToGradeRow({ ...serverToGrade, student: null })).toBeNull()
    expect(parseToGradeRow({ ...serverToGrade, assignment: { ...serverToGrade.assignment, type: 'quiz' } })).toBeNull()
  })

  it('lit un devoir d’élève, sans rendu', () => {
    expect(parseStudentAssignmentRow(serverAssignment)).toEqual({
      id: '01JB',
      title: 'La bibliothèque',
      type: 'exercise',
      dueAt: '2026-10-01T18:00:00+00:00',
      isOverdue: false,
      classroom: { id: '01CL', name: 'BUT2 MMI' },
      hasBase: true,
      hasImage: false,
      state: 'todo',
      documentId: null,
      submission: null,
    })
  })

  it('traduit l’état en cours du serveur dans le vocabulaire maison', () => {
    const row = parseStudentAssignmentRow({
      ...serverAssignment,
      state: 'in_progress',
      document_id: '01DOC',
    })
    expect(row?.state).toBe('started')
    expect(row?.documentId).toBe('01DOC')
  })

  it('lit un rendu noté, avec sa note et son commentaire', () => {
    const row = parseStudentAssignmentRow({
      ...serverAssignment,
      state: 'graded',
      submission: {
        id: '01SB',
        status: 'graded',
        submitted_at: '2026-10-02T08:00:00+00:00',
        is_late: true,
        grade: '17/20',
        feedback: 'Très bien.',
        graded_at: '2026-10-03T09:00:00+00:00',
      },
    })
    expect(row?.state).toBe('graded')
    expect(row?.submission).toEqual({
      id: '01SB',
      status: 'graded',
      submittedAt: '2026-10-02T08:00:00+00:00',
      isLate: true,
      grade: '17/20',
      feedback: 'Très bien.',
      gradedAt: '2026-10-03T09:00:00+00:00',
    })
  })

  it('lit un retard inconnu comme une absence de retard', () => {
    const row = parseStudentAssignmentRow({
      ...serverAssignment,
      state: 'submitted',
      submission: {
        id: '01SB',
        status: 'submitted',
        submitted_at: null,
        is_late: null,
        grade: null,
        feedback: null,
        graded_at: null,
      },
    })
    expect(row?.submission?.isLate).toBe(false)
  })

  it('refuse un devoir d’élève à l’état inconnu ou au rendu abîmé', () => {
    expect(parseStudentAssignmentRow({ ...serverAssignment, state: 'pending' })).toBeNull()
    expect(parseStudentAssignmentRow({ ...serverAssignment, submission: { id: '01SB' } })).toBeNull()
    expect(parseStudentAssignmentRow({ ...serverAssignment, document_id: 42 })).toBeNull()
  })
})

describe('vues d’ensemble, appels', () => {
  it('demande la première page de la file à corriger', async () => {
    const { client, sent } = scriptedClient([page([serverToGrade], { current_page: 1, last_page: 3, total: 120 })])
    const result = await listToGrade(client)
    expect(sent[0]).toEqual({ method: 'GET', path: '/overview/to-grade?page=1', body: undefined })
    expect(result).toMatchObject({
      ok: true,
      value: { currentPage: 1, lastPage: 3, total: 120 },
    })
    expect(result.ok && result.value.rows).toHaveLength(1)
  })

  it('demande la page suivante quand on la réclame', async () => {
    const { client, sent } = scriptedClient([page([], { current_page: 2, last_page: 2, total: 60 })])
    await listToGrade(client, 2)
    expect(sent[0]?.path).toBe('/overview/to-grade?page=2')
  })

  it('lit une réponse sans enveloppe comme une page unique', async () => {
    const { client } = scriptedClient([ok([serverToGrade])])
    const result = await listToGrade(client)
    expect(result).toMatchObject({ ok: true, value: { currentPage: 1, lastPage: 1, total: 1 } })
  })

  it('invalide toute la file dès qu’une ligne est illisible', async () => {
    const { client } = scriptedClient([ok([serverToGrade, { submission_id: '' }])])
    const result = await listToGrade(client)
    expect(result.ok).toBe(false)
  })

  it('remonte l’erreur du serveur telle quelle', async () => {
    const error = apiError('forbidden', 403, 'Accès refusé.')
    const { client } = scriptedClient([{ ok: false, error }])
    expect(await listToGrade(client)).toEqual({ ok: false, error })
  })

  it('demande les devoirs de l’élève en un seul appel, sans pagination', async () => {
    const { client, sent } = scriptedClient([ok([serverAssignment, { ...serverAssignment, id: '01JC' }])])
    const result = await listMyAssignments(client)
    expect(sent).toHaveLength(1)
    expect(sent[0]).toEqual({ method: 'GET', path: '/overview/my-assignments', body: undefined })
    expect(result.ok && result.value.map((row) => row.id)).toEqual(['01JB', '01JC'])
  })

  it('invalide toute la liste des devoirs dès qu’une ligne est illisible', async () => {
    const { client } = scriptedClient([ok([serverAssignment, { ...serverAssignment, classroom: null }])])
    expect((await listMyAssignments(client)).ok).toBe(false)
  })

  it('refuse une réponse qui n’est pas une liste', async () => {
    const { client } = scriptedClient([ok({ rows: [] })])
    expect((await listMyAssignments(client)).ok).toBe(false)
  })
})

describe('vues d’ensemble, affichage', () => {
  it('compte les rendus affichés quand il en reste', () => {
    expect(pageCountLabel(50, 112)).toBe('50 rendus affichés sur 112')
    expect(pageCountLabel(1, 4)).toBe('1 rendu affiché sur 4')
  })

  it('annonce le total seul quand tout est là', () => {
    expect(pageCountLabel(3, 3)).toBe('3 rendus')
    expect(pageCountLabel(1, 1)).toBe('1 rendu')
  })
})
