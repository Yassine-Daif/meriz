import { describe, expect, it } from 'vitest'
import type { ApiClient, ApiResult, HttpMethod } from './apiClient'
import { apiError } from './apiClient'
import {
  createClassroom,
  deleteClassroom,
  formatJoinCode,
  getClassroom,
  joinClassroom,
  leaveClassroom,
  listClassrooms,
  normalizeJoinCode,
  parseClassroomDetail,
  regenerateJoinCode,
  removeMember,
  renameClassroom,
} from './classroomsApi'

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
    // Le binaire n'est pas simulé ici : aucun test ne lit d'image.
    requestBlob: async () => ({ ok: false, error: apiError('unexpected', null, 'Binaire non simulé.') }),
    }
  return { client, sent }
}

const teacher = { id: 1, name: 'Codd', first_name: 'Edgar', bio: null, contact: 'prof@ecole.fr' }
const member = { id: 2, name: 'Lovelace', first_name: 'Ada', bio: 'Bonjour', contact: null }

const teacherView = {
  id: '01J8ZCLASSE',
  name: 'MMI 2',
  my_role: 'teacher',
  join_code: 'ABCD2345',
  members_count: 1,
  teacher,
  members: [{ ...member, joined_at: '2026-09-18T10:00:00+00:00' }],
  created_at: '2026-09-18T09:00:00+00:00',
}

const studentView = {
  id: '01J8ZCLASSE',
  name: 'MMI 2',
  my_role: 'student',
  members_count: 1,
  teacher,
  members: [member],
  created_at: '2026-09-18T09:00:00+00:00',
}

const ok = (data: unknown, status = 200): ApiResult => ({ ok: true, status, data, body: { data } })

describe('classes, lecture des réponses', () => {
  it('vue du prof : code et dates d’arrivée', () => {
    const classroom = parseClassroomDetail(teacherView)

    expect(classroom).toMatchObject({
      myRole: 'teacher',
      joinCode: 'ABCD2345',
      teacher: { firstName: 'Edgar', name: 'Codd', contact: 'prof@ecole.fr' },
      members: [{ id: 2, firstName: 'Ada', joinedAt: '2026-09-18T10:00:00+00:00' }],
    })
  })

  it("vue d'un élève : ni code ni date d'arrivée", () => {
    const classroom = parseClassroomDetail(studentView)

    expect(classroom?.myRole).toBe('student')
    expect(classroom?.joinCode).toBeNull()
    expect(classroom?.members[0]?.joinedAt).toBeNull()
  })

  it("n'expose jamais d'email, même si le serveur en renvoyait un", () => {
    const classroom = parseClassroomDetail({
      ...studentView,
      members: [{ ...member, email: 'secret@connexion.fr' }],
    })

    expect(JSON.stringify(classroom)).not.toContain('secret@connexion.fr')
  })

  it('porte les couleurs de pastille du prof et des membres', () => {
    const classroom = parseClassroomDetail({
      ...teacherView,
      teacher: { ...teacherView.teacher, avatar_bg: '#DCFCE7', avatar_fg: '#14532d' },
    })

    expect(classroom?.teacher).toMatchObject({ avatarBg: '#dcfce7', avatarFg: '#14532d' })
    // Membre sans couleurs : les valeurs par défaut, sans rejet.
    expect(classroom?.members[0]).toMatchObject({ avatarBg: '#e0e7ff', avatarFg: '#1e1b4b' })
  })

  it('refuse une réponse mal formée', () => {    expect(parseClassroomDetail({ ...teacherView, my_role: 'admin' })).toBeNull()
    expect(parseClassroomDetail({ ...teacherView, members: [{ id: 'x' }] })).toBeNull()
    expect(parseClassroomDetail({ ...teacherView, members: undefined })).toBeNull()
  })
})

describe('classes, appels', () => {
  it('liste, lit, rejoint et quitte sur les bons chemins', async () => {
    const { client, sent } = scriptedClient([ok([teacherView]), ok(studentView), ok(studentView)])

    const listed = await listClassrooms(client)
    await getClassroom(client, '01J8ZCLASSE')
    await joinClassroom(client, ' abcd-2345 ')
    await leaveClassroom(client, '01J8ZCLASSE')

    expect(listed.ok && listed.value.map((c) => c.name)).toEqual(['MMI 2'])
    expect(sent).toEqual([
      { method: 'GET', path: '/classrooms', body: undefined },
      { method: 'GET', path: '/classrooms/01J8ZCLASSE', body: undefined },
      { method: 'POST', path: '/classrooms/join', body: { code: 'ABCD2345' } },
      { method: 'DELETE', path: '/classrooms/01J8ZCLASSE/membership', body: undefined },
    ])
  })

  it('crée, renomme, régénère, retire et supprime (prof)', async () => {
    const { client, sent } = scriptedClient([ok(teacherView, 201), ok(teacherView), ok(teacherView)])

    await createClassroom(client, 'MMI 2')
    await renameClassroom(client, '01J8ZCLASSE', 'MMI 2B')
    await regenerateJoinCode(client, '01J8ZCLASSE')
    await removeMember(client, '01J8ZCLASSE', 2)
    await deleteClassroom(client, '01J8ZCLASSE')

    expect(sent).toEqual([
      { method: 'POST', path: '/classrooms', body: { name: 'MMI 2' } },
      { method: 'PATCH', path: '/classrooms/01J8ZCLASSE', body: { name: 'MMI 2B' } },
      { method: 'POST', path: '/classrooms/01J8ZCLASSE/code', body: undefined },
      { method: 'DELETE', path: '/classrooms/01J8ZCLASSE/members/2', body: undefined },
      { method: 'DELETE', path: '/classrooms/01J8ZCLASSE', body: undefined },
    ])
  })

  it("transmet l'erreur de code du serveur", async () => {
    const { client } = scriptedClient([
      {
        ok: false,
        error: {
          kind: 'validation',
          status: 422,
          message: 'Vérifiez les informations saisies.',
          fieldErrors: { code: ['Code de classe invalide.'] },
        },
      },
    ])

    const result = await joinClassroom(client, 'zzzz')

    expect(result.ok ? null : result.error.fieldErrors.code).toEqual(['Code de classe invalide.'])
  })
})

describe('code de classe', () => {
  it('tolère minuscules, espaces et tirets', () => {
    expect(normalizeJoinCode(' abcd-2345 ')).toBe('ABCD2345')
    expect(normalizeJoinCode('ab cd 23 45')).toBe('ABCD2345')
    expect(normalizeJoinCode('---')).toBe('')
  })

  it("s'affiche groupé par quatre", () => {
    expect(formatJoinCode('ABCD2345')).toBe('ABCD-2345')
    expect(formatJoinCode('abcd-2345')).toBe('ABCD-2345')
    expect(formatJoinCode('ABC')).toBe('ABC')
  })
})
