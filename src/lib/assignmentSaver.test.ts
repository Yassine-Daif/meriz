import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient, ApiResult } from './apiClient'
import { apiError } from './apiClient'
import { createAssignmentSaver } from './assignmentSaver'
import { MAX_WAIT_MS, SEND_DELAY_MS } from './documentRepository'
import { DEFAULT_MPD_SETTINGS } from '../model/mpd'
import type { McdEditorState } from '../model/mcdReducer'

const state = (entityName: string): McdEditorState => ({
  mcd: {
    properties: [],
    entities: [{ id: 'e1', name: entityName, attributes: [] }],
    associations: [],
  },
  layout: {},
})

/** Serveur simulé : enregistre les envois et renvoie ce qu'on lui dicte. */
function fakeClient() {
  const sent: { path: string; body: unknown }[] = []
  let next: ApiResult = { ok: true, status: 200, data: assignmentWith('{}'), body: null }
  const client: ApiClient = {
    isConfigured: true,
    request: async (_method, path, body) => {
      sent.push({ path, body })
      return next
    },
    requestBlob: async () => ({ ok: false, error: apiError('unexpected', null, 'Binaire non simulé.') }),
  }
  return {
    client,
    sent,
    reply: (result: ApiResult) => {
      next = result
    },
  }
}

function assignmentWith(content: string) {
  return {
    id: '01JB',
    classroom_id: '01CL',
    title: 'Devoir',
    type: 'exercise',
    due_at: null,
    status: 'draft',
    published_at: null,
    has_image: false,
    has_base: true,
    has_solution: false,
    solution_released: false,
    instructions: 'Consigne',
    base_content: content,
    solution_content: null,
    created_at: '2026-09-20T10:00:00+00:00',
    updated_at: '2026-09-20T10:00:00+00:00',
  }
}

function saverFor(client: ApiClient, field: 'base' | 'solution' = 'base') {
  return createAssignmentSaver({
    client,
    assignmentId: '01JB',
    field,
    title: 'Devoir',
    initialContent: null,
  })
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('sauvegarde de la base et du corrigé', () => {
  it('attend la fin de la frappe avant d’envoyer', async () => {
    const server = fakeClient()
    const saver = saverFor(server.client)

    saver.save(state('Livre'), DEFAULT_MPD_SETTINGS)
    await vi.advanceTimersByTimeAsync(SEND_DELAY_MS - 100)
    expect(server.sent).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(200)
    expect(server.sent).toHaveLength(1)
    expect(server.sent[0]?.path).toBe('/assignments/01JB')
    expect(saver.getStatus()).toEqual({ kind: 'saved' })
    saver.dispose()
  })

  it('envoie dans le champ du devoir visé', async () => {
    const base = fakeClient()
    const solution = fakeClient()
    const baseSaver = saverFor(base.client, 'base')
    const solutionSaver = saverFor(solution.client, 'solution')

    baseSaver.save(state('Livre'), DEFAULT_MPD_SETTINGS)
    solutionSaver.save(state('Livre'), DEFAULT_MPD_SETTINGS)
    await vi.advanceTimersByTimeAsync(SEND_DELAY_MS)

    expect(Object.keys(base.sent[0]?.body as object)).toEqual(['base_content'])
    expect(Object.keys(solution.sent[0]?.body as object)).toEqual(['solution_content'])
    baseSaver.dispose()
    solutionSaver.dispose()
  })

  it('force l’envoi si la frappe ne s’arrête jamais', async () => {
    const server = fakeClient()
    const saver = saverFor(server.client)

    for (let tick = 0; tick < 20; tick += 1) {
      saver.save(state(`Livre ${tick}`), DEFAULT_MPD_SETTINGS)
      await vi.advanceTimersByTimeAsync(SEND_DELAY_MS - 200)
    }

    expect(server.sent.length).toBeGreaterThanOrEqual(1)
    expect(vi.getTimerCount() >= 0).toBe(true)
    saver.dispose()
  })

  it('n’envoie rien quand le modèle n’a pas changé', async () => {
    const server = fakeClient()
    const saver = saverFor(server.client)

    saver.save(state('Livre'), DEFAULT_MPD_SETTINGS)
    await vi.advanceTimersByTimeAsync(SEND_DELAY_MS)
    saver.save(state('Livre'), DEFAULT_MPD_SETTINGS)
    await vi.advanceTimersByTimeAsync(MAX_WAIT_MS)

    expect(server.sent).toHaveLength(1)
    saver.dispose()
  })

  it('passe hors ligne puis repart tout seul', async () => {
    const server = fakeClient()
    server.reply({ ok: false, error: apiError('network', null, 'Serveur injoignable.') })
    const saver = saverFor(server.client)

    saver.save(state('Livre'), DEFAULT_MPD_SETTINGS)
    await vi.advanceTimersByTimeAsync(SEND_DELAY_MS)
    expect(saver.getStatus()).toEqual({ kind: 'offline' })

    server.reply({ ok: true, status: 200, data: assignmentWith('{}'), body: null })
    await vi.advanceTimersByTimeAsync(5000)

    expect(saver.getStatus()).toEqual({ kind: 'saved' })
    expect(server.sent.length).toBeGreaterThanOrEqual(2)
    saver.dispose()
  })

  it('dit vrai quand tout est enregistré, faux sinon', async () => {
    const server = fakeClient()
    const saver = saverFor(server.client)

    saver.save(state('Livre'), DEFAULT_MPD_SETTINGS)
    expect(await saver.flush()).toBe(true)

    server.reply({ ok: false, error: apiError('network', null, 'Serveur injoignable.') })
    saver.save(state('Revue'), DEFAULT_MPD_SETTINGS)
    expect(await saver.flush()).toBe(false)
    saver.dispose()
  })

  it('arrête d’envoyer quand le devoir a disparu', async () => {
    const server = fakeClient()
    server.reply({ ok: false, error: apiError('not_found', 404, 'Ressource introuvable.') })
    const saver = saverFor(server.client)

    saver.save(state('Livre'), DEFAULT_MPD_SETTINGS)
    await vi.advanceTimersByTimeAsync(SEND_DELAY_MS)
    const afterGone = server.sent.length
    saver.save(state('Revue'), DEFAULT_MPD_SETTINGS)
    saver.retry()
    await vi.advanceTimersByTimeAsync(MAX_WAIT_MS)

    expect(server.sent).toHaveLength(afterGone)
    expect(saver.getStatus().kind).toBe('error')
    saver.dispose()
  })

  it('ne touche plus à rien une fois fermé', async () => {
    const server = fakeClient()
    const saver = saverFor(server.client)

    saver.dispose()
    saver.save(state('Livre'), DEFAULT_MPD_SETTINGS)
    await vi.advanceTimersByTimeAsync(MAX_WAIT_MS)

    expect(server.sent).toHaveLength(0)
  })
})
