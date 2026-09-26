import { describe, expect, it } from 'vitest'
import type { ApiClient, ApiResult, HttpMethod } from './apiClient'
import { apiError } from './apiClient'
import {
  disableLiveTracking,
  enableLiveTracking,
  formatLastActivity,
  formatLastObservation,
  getLastObservedAt,
  getLiveSnapshot,
  listLiveWorkers,
  liveStateLabel,
  parseLiveSnapshot,
  parseLiveWorker,
} from './liveApi'
import type { LiveWorker } from './liveApi'

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

/** Ligne d'avancement, telle que le serveur la renvoie. */
const serverWorker = {
  student,
  has_started: true,
  last_activity_at: '2026-09-26T08:00:00+00:00',
  last_observed_at: null,
  submission_status: null,
}

/** Instantané du travail d'un élève. */
const serverSnapshot = {
  document_id: '01DOC',
  student,
  name: 'Les commandes',
  content: '{"format":"meriz-mcd"}',
  updated_at: '2026-09-26T08:00:00+00:00',
  observed_at: '2026-09-26T08:00:03+00:00',
}

/** Devoir complet, avec le drapeau de suivi. */
const serverAssignment = {
  id: '01JB',
  classroom_id: '01CL',
  title: 'Les commandes',
  type: 'exercise',
  due_at: null,
  status: 'published',
  published_at: '2026-09-20T08:00:00+00:00',
  has_image: false,
  image_url: null,
  has_base: true,
  has_solution: true,
  solution_released: false,
  live_tracking: true,
  live_tracking_enabled_at: '2026-09-26T07:59:00+00:00',
  instructions: 'Modélisez les commandes.',
  base_content: null,
  solution_content: null,
  created_at: '2026-09-20T08:00:00+00:00',
  updated_at: '2026-09-26T07:59:00+00:00',
}

describe('suivi en direct, lecture des réponses', () => {
  it('lit une ligne d’avancement', () => {
    expect(parseLiveWorker(serverWorker)).toEqual({
      student: {
        id: 12,
        name: 'Roy',
        firstName: 'Camille',
        bio: null,
        contact: null,
        avatarBg: '#e0e7ff',
        avatarFg: '#1e1b4b',
      },
      hasStarted: true,
      lastActivityAt: '2026-09-26T08:00:00+00:00',
      lastObservedAt: null,
      submissionStatus: null,
    })
  })

  it('lit un état de rendu connu, et ignore celui qu’il ne connaît pas', () => {
    expect(parseLiveWorker({ ...serverWorker, submission_status: 'graded' })?.submissionStatus).toBe('graded')
    expect(parseLiveWorker({ ...serverWorker, submission_status: 'submitted' })?.submissionStatus).toBe('submitted')
    // « brouillon » n'existe pas dans l'application : rien de rendu.
    expect(parseLiveWorker({ ...serverWorker, submission_status: 'draft' })?.submissionStatus).toBeNull()
  })

  it('refuse une ligne sans élève ou aux dates abîmées', () => {
    expect(parseLiveWorker({ ...serverWorker, student: null })).toBeNull()
    expect(parseLiveWorker({ ...serverWorker, last_activity_at: 42 })).toBeNull()
    expect(parseLiveWorker(null)).toBeNull()
  })

  it('lit un instantané, contenu compris', () => {
    const snapshot = parseLiveSnapshot(serverSnapshot)
    expect(snapshot).toMatchObject({
      documentId: '01DOC',
      name: 'Les commandes',
      content: '{"format":"meriz-mcd"}',
      updatedAt: '2026-09-26T08:00:00+00:00',
      observedAt: '2026-09-26T08:00:03+00:00',
    })
    expect(snapshot?.student.firstName).toBe('Camille')
  })

  it('refuse un instantané sans contenu ou sans document', () => {
    expect(parseLiveSnapshot({ ...serverSnapshot, content: null })).toBeNull()
    expect(parseLiveSnapshot({ ...serverSnapshot, document_id: '' })).toBeNull()
    expect(parseLiveSnapshot({ ...serverSnapshot, student: null })).toBeNull()
  })
})

describe('suivi en direct, appels', () => {
  it('ouvre et ferme le suivi, et relit le devoir', async () => {
    const { client, sent } = scriptedClient([ok(serverAssignment), ok({ ...serverAssignment, live_tracking: false })])

    const ouvert = await enableLiveTracking(client, '01JB')
    expect(sent[0]).toEqual({ method: 'POST', path: '/assignments/01JB/live-tracking', body: undefined })
    expect(ouvert.ok && ouvert.value.liveTracking).toBe(true)
    expect(ouvert.ok && ouvert.value.liveTrackingEnabledAt).toBe('2026-09-26T07:59:00+00:00')

    const ferme = await disableLiveTracking(client, '01JB')
    expect(sent[1]).toEqual({ method: 'DELETE', path: '/assignments/01JB/live-tracking', body: undefined })
    expect(ferme.ok && ferme.value.liveTracking).toBe(false)
  })

  it('demande l’avancement de la classe', async () => {
    const { client, sent } = scriptedClient([ok([serverWorker, { ...serverWorker, has_started: false }])])
    const result = await listLiveWorkers(client, '01JB')
    expect(sent[0]).toEqual({ method: 'GET', path: '/assignments/01JB/live', body: undefined })
    expect(result.ok && result.value.map((worker) => worker.hasStarted)).toEqual([true, false])
  })

  it('invalide toute la liste dès qu’une ligne est illisible', async () => {
    const { client } = scriptedClient([ok([serverWorker, { student: null }])])
    expect((await listLiveWorkers(client, '01JB')).ok).toBe(false)
  })

  it('demande l’instantané d’un élève', async () => {
    const { client, sent } = scriptedClient([ok(serverSnapshot)])
    const result = await getLiveSnapshot(client, '01 JB', 12)
    expect(sent[0]).toEqual({ method: 'GET', path: '/assignments/01%20JB/live/12', body: undefined })
    expect(result.ok && result.value.content).toBe('{"format":"meriz-mcd"}')
  })

  it('remonte tel quel l’introuvable d’un élève qui n’a pas commencé', async () => {
    const error = apiError('not_found', 404, 'Ressource introuvable.')
    const { client } = scriptedClient([{ ok: false, error }])
    expect(await getLiveSnapshot(client, '01JB', 12)).toEqual({ ok: false, error })
  })

  it('lit l’heure de dernière lecture sur mon propre document', async () => {
    const { client, sent } = scriptedClient([
      ok({ id: '01DOC', name: 'Mon travail', content: '{}', last_observed_at: '2026-09-26T08:00:03+00:00' }),
    ])
    const result = await getLastObservedAt(client, '01DOC')
    expect(sent[0]).toEqual({ method: 'GET', path: '/documents/01DOC', body: undefined })
    expect(result).toEqual({ ok: true, value: '2026-09-26T08:00:03+00:00' })
  })

  it('lit une absence de lecture comme telle', async () => {
    const { client } = scriptedClient([ok({ id: '01DOC', last_observed_at: null })])
    expect(await getLastObservedAt(client, '01DOC')).toEqual({ ok: true, value: null })
  })

  it('refuse une heure de lecture qui n’est pas un texte', async () => {
    const { client } = scriptedClient([ok({ id: '01DOC', last_observed_at: 42 })])
    expect((await getLastObservedAt(client, '01DOC')).ok).toBe(false)
  })
})

describe('suivi en direct, affichage', () => {
  const worker = (patch: Partial<LiveWorker>): LiveWorker => ({
    student: {
      id: 12,
      name: 'Roy',
      firstName: 'Camille',
      bio: null,
      contact: null,
      avatarBg: '#e0e7ff',
      avatarFg: '#1e1b4b',
    },
    hasStarted: true,
    lastActivityAt: null,
    lastObservedAt: null,
    submissionStatus: null,
    ...patch,
  })

  it('dit l’avancement en toutes lettres', () => {
    expect(liveStateLabel(worker({ hasStarted: false }))).toBe('N’a pas commencé')
    expect(liveStateLabel(worker({}))).toBe('Au travail')
    expect(liveStateLabel(worker({ submissionStatus: 'submitted' }))).toBe('Rendu')
    expect(liveStateLabel(worker({ submissionStatus: 'graded' }))).toBe('Noté')
  })

  it('situe la dernière activité', () => {
    const now = Date.parse('2026-09-26T08:10:00+00:00')
    expect(formatLastActivity(null, now)).toBe('Aucune activité')
    expect(formatLastActivity('2026-09-26T08:09:45+00:00', now)).toBe('Activité à l’instant')
    expect(formatLastActivity('2026-09-26T08:05:00+00:00', now)).toBe('Activité il y a 5 minutes')
    expect(formatLastActivity('pas une date', now)).toBe('Activité à une date inconnue')
  })

  it('situe la dernière lecture, ou se tait', () => {
    const now = Date.parse('2026-09-26T08:10:00+00:00')
    expect(formatLastObservation(null, now)).toBeNull()
    expect(formatLastObservation('2026-09-26T08:09:59+00:00', now)).toBe('Lu à l’instant')
    expect(formatLastObservation('2026-09-26T07:10:00+00:00', now)).toBe('Lu il y a 1 heure')
  })
})
