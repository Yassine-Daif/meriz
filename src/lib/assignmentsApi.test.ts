import { describe, expect, it } from 'vitest'
import type { ApiClient, ApiResult, HttpMethod } from './apiClient'
import { apiError } from './apiClient'
import {
  copyAssignmentBase,
  createAssignment,
  deleteAssignment,
  formatDueDate,
  fromLocalInput,
  listClassroomAssignments,
  parseAssignment,
  publishAssignment,
  releaseSolution,
  removeAssignmentImage,
  toLocalInput,
  unpublishAssignment,
  updateAssignment,
  uploadAssignmentImage,
  withholdSolution,
} from './assignmentsApi'

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

/** Devoir tel que le serveur le renvoie au prof. */
const serverAssignment = {
  id: '01JB',
  classroom_id: '01CL',
  title: 'Modéliser une bibliothèque',
  type: 'exercise',
  due_at: '2026-10-01T16:00:00+00:00',
  status: 'draft',
  published_at: null,
  has_image: false,
  has_base: true,
  has_solution: true,
  solution_released: false,
  instructions: 'Modélisez le prêt de livres.',
  base_content: '{"format":"meriz-mcd"}',
  solution_content: '{"format":"meriz-mcd","name":"corrigé"}',
  created_at: '2026-09-20T10:00:00+00:00',
  updated_at: '2026-09-20T11:00:00+00:00',
}

describe('devoirs, lecture des réponses', () => {
  it('lit un devoir complet, vu du prof', () => {
    expect(parseAssignment(serverAssignment)).toMatchObject({
      id: '01JB',
      classroomId: '01CL',
      title: 'Modéliser une bibliothèque',
      type: 'exercise',
      status: 'draft',
      hasBase: true,
      hasSolution: true,
      solutionReleased: false,
      instructions: 'Modélisez le prêt de livres.',
      solutionContent: '{"format":"meriz-mcd","name":"corrigé"}',
    })
  })

  it("tolère la vue d'un élève : ni corrigé ni présence de corrigé", () => {
    const { has_solution, solution_content, ...studentView } = serverAssignment
    void has_solution
    void solution_content

    expect(parseAssignment(studentView)).toMatchObject({
      hasSolution: false,
      solutionContent: null,
      baseContent: '{"format":"meriz-mcd"}',
    })
  })

  it('refuse une réponse mal formée', () => {
    expect(parseAssignment({ ...serverAssignment, type: 'devoir' })).toBeNull()
    expect(parseAssignment({ ...serverAssignment, status: 'archived' })).toBeNull()
    expect(parseAssignment({ ...serverAssignment, instructions: 42 })).toBeNull()
    expect(parseAssignment({ ...serverAssignment, due_at: 12 })).toBeNull()
  })

  it('liste les devoirs d’une classe, et refuse une ligne mal formée', async () => {
    const good = scriptedClient([ok([serverAssignment, { ...serverAssignment, id: '01JC' }])])
    const bad = scriptedClient([ok([serverAssignment, { id: '01JD' }])])

    const first = await listClassroomAssignments(good.client, '01CL')
    const second = await listClassroomAssignments(bad.client, '01CL')

    expect(good.sent[0]).toEqual({ method: 'GET', path: '/classrooms/01CL/assignments', body: undefined })
    expect(first.ok && first.value.map((a) => a.id)).toEqual(['01JB', '01JC'])
    expect(second.ok ? null : second.error.kind).toBe('unexpected')
  })
})

describe('devoirs, appels', () => {
  it('crée sur le chemin de la classe, avec les champs du serveur', async () => {
    const { client, sent } = scriptedClient([ok(serverAssignment)])

    await createAssignment(client, '01CL', {
      title: 'Titre',
      instructions: 'Consigne',
      type: 'exam',
      dueAt: '2026-10-01T16:00:00.000Z',
    })

    expect(sent[0]).toEqual({
      method: 'POST',
      path: '/classrooms/01CL/assignments',
      body: { title: 'Titre', instructions: 'Consigne', type: 'exam', due_at: '2026-10-01T16:00:00.000Z' },
    })
  })

  it("n'envoie que les champs fournis à la modification", async () => {
    const { client, sent } = scriptedClient([ok(serverAssignment), ok(serverAssignment)])

    await updateAssignment(client, '01JB', { baseContent: '{"a":1}' })
    await updateAssignment(client, '01JB', { solutionContent: null, title: 'Autre' })

    expect(sent[0]).toEqual({ method: 'PATCH', path: '/assignments/01JB', body: { base_content: '{"a":1}' } })
    expect(sent[1]?.body).toEqual({ title: 'Autre', solution_content: null })
  })

  it('publie, dépublie, libère et retient sur les bons chemins', async () => {
    const { client, sent } = scriptedClient([ok(serverAssignment), ok(serverAssignment), ok(serverAssignment), ok(serverAssignment)])

    await publishAssignment(client, '01JB')
    await unpublishAssignment(client, '01JB')
    await releaseSolution(client, '01JB')
    await withholdSolution(client, '01JB')

    expect(sent.map((call) => `${call.method} ${call.path}`)).toEqual([
      'POST /assignments/01JB/publication',
      'DELETE /assignments/01JB/publication',
      'POST /assignments/01JB/solution-release',
      'DELETE /assignments/01JB/solution-release',
    ])
  })

  it('supprime, et rend le refus du serveur tel quel', async () => {
    const error = apiError('forbidden', 403, 'Réservé au prof de la classe.')
    const { client, sent } = scriptedClient([{ ok: false, error }])

    const outcome = await deleteAssignment(client, '01JB')

    expect(sent[0]).toMatchObject({ method: 'DELETE', path: '/assignments/01JB' })
    expect(outcome).toEqual({ ok: false, error })
  })

  it("envoie l'image en multipart, sans la sérialiser", async () => {
    const { client, sent } = scriptedClient([ok({ ...serverAssignment, has_image: true })])
    const file = new File(['binaire'], 'schema.png', { type: 'image/png' })

    await uploadAssignmentImage(client, '01JB', file)

    const body = sent[0]?.body
    expect(sent[0]).toMatchObject({ method: 'POST', path: '/assignments/01JB/image' })
    expect(body).toBeInstanceOf(FormData)
    expect((body as FormData).get('image')).toBe(file)
  })

  it('copie la base dans un document personnel, sans corps de requête', async () => {
    const { client, sent } = scriptedClient([
      ok({
        id: '01DOC',
        name: 'Modéliser une bibliothèque',
        content: '{"format":"meriz-mcd"}',
        created_at: '2026-09-21T10:00:00+00:00',
        updated_at: '2026-09-21T10:00:00+00:00',
      }),
    ])

    const outcome = await copyAssignmentBase(client, '01JB')

    expect(sent[0]).toEqual({ method: 'POST', path: '/assignments/01JB/copy', body: undefined })
    expect(outcome.ok && outcome.value).toMatchObject({ id: '01DOC', content: '{"format":"meriz-mcd"}' })
  })

  it("remonte tel quel le refus d'une copie sans base", async () => {
    const error = apiError('validation', 422, 'Les informations saisies sont invalides.')
    error.fieldErrors = { base_content: ["Ce devoir n'a pas de base. Commencez sur une page blanche."] }
    const { client } = scriptedClient([{ ok: false, error }])

    const outcome = await copyAssignmentBase(client, '01JB')

    expect(outcome).toEqual({ ok: false, error })
  })

  it("retire l'image sur son chemin", async () => {
    const { client, sent } = scriptedClient([ok(serverAssignment)])

    await removeAssignmentImage(client, '01JB')

    expect(sent[0]).toMatchObject({ method: 'DELETE', path: '/assignments/01JB/image' })
  })
})

describe('devoirs, dates', () => {
  it('convertit la saisie locale en ISO, et une saisie vide en « sans échéance »', () => {
    const iso = fromLocalInput('2026-10-01T18:00')

    expect(iso).not.toBeNull()
    expect(new Date(iso ?? '').getMinutes()).toBe(0)
    expect(fromLocalInput('   ')).toBeNull()
    expect(fromLocalInput('pas une date')).toBeNull()
  })

  it('refait le chemin inverse sans décaler l’heure affichée', () => {
    const local = toLocalInput(fromLocalInput('2026-10-01T18:00'))

    expect(local).toBe('2026-10-01T18:00')
    expect(toLocalInput(null)).toBe('')
    expect(toLocalInput('pas une date')).toBe('')
  })

  it('écrit l’échéance en toutes lettres', () => {
    expect(formatDueDate(null)).toBe('Sans échéance')
    expect(formatDueDate('pas une date')).toBe('Échéance inconnue')
    expect(formatDueDate('2026-10-01T16:00:00+00:00')).toContain('À rendre le')
  })
})
