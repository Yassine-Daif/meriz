import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient, ApiResult } from './apiClient'
import { apiError } from './apiClient'
import { MAX_WAIT_MS, SEND_DELAY_MS } from './documentRepository'
import { createLessonSaver } from './lessonSaver'

function lessonWith(title: string, blocks: string) {
  return {
    id: '01LE',
    classroom_id: '01CL',
    title,
    status: 'draft',
    published_at: null,
    media_count: 0,
    blocks,
    media: [],
    created_at: '2026-09-25T09:00:00+00:00',
    updated_at: '2026-09-25T10:00:00+00:00',
  }
}

/** Serveur simulé : enregistre les envois et renvoie ce qu'on lui dicte. */
function fakeClient() {
  const sent: { path: string; body: unknown }[] = []
  let next: ApiResult = { ok: true, status: 200, data: lessonWith('Titre', '[]'), body: null }
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

function saverFor(client: ApiClient) {
  return createLessonSaver({ client, lessonId: '01LE', initialTitle: 'Titre', initialBlocks: '[]' })
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('sauvegarde automatique d’un cours', () => {
  it('attend la fin de la frappe avant d’envoyer', async () => {
    const server = fakeClient()
    const saver = saverFor(server.client)

    saver.save('Titre', '[{"type":"text","text":"a"}]')
    await vi.advanceTimersByTimeAsync(SEND_DELAY_MS - 100)
    expect(server.sent).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(200)
    expect(server.sent).toHaveLength(1)
    expect(server.sent[0]?.path).toBe('/lessons/01LE')
    expect(server.sent[0]?.body).toEqual({ title: 'Titre', blocks: '[{"type":"text","text":"a"}]' })
    expect(saver.getStatus()).toEqual({ kind: 'saved' })
    saver.dispose()
  })

  it('envoie le titre et la page ensemble', async () => {
    const server = fakeClient()
    const saver = saverFor(server.client)

    saver.save('Autre titre', '[]')
    await vi.advanceTimersByTimeAsync(SEND_DELAY_MS)

    expect(Object.keys(server.sent[0]?.body as object).sort()).toEqual(['blocks', 'title'])
    saver.dispose()
  })

  it('force l’envoi si la frappe ne s’arrête jamais', async () => {
    const server = fakeClient()
    const saver = saverFor(server.client)

    for (let tick = 0; tick < 20; tick += 1) {
      saver.save('Titre', `[{"type":"text","text":"${tick}"}]`)
      await vi.advanceTimersByTimeAsync(SEND_DELAY_MS - 200)
    }

    expect(server.sent.length).toBeGreaterThanOrEqual(1)
    saver.dispose()
  })

  it('n’envoie rien quand rien n’a changé', async () => {
    const server = fakeClient()
    const saver = saverFor(server.client)

    saver.save('Titre', '[]')
    await vi.advanceTimersByTimeAsync(MAX_WAIT_MS)

    expect(server.sent).toHaveLength(0)
    saver.dispose()
  })

  it('passe hors ligne puis repart tout seul', async () => {
    const server = fakeClient()
    server.reply({ ok: false, error: apiError('network', null, 'Serveur injoignable.') })
    const saver = saverFor(server.client)

    saver.save('Titre', '[{"type":"text","text":"a"}]')
    await vi.advanceTimersByTimeAsync(SEND_DELAY_MS)
    expect(saver.getStatus()).toEqual({ kind: 'offline' })

    server.reply({ ok: true, status: 200, data: lessonWith('Titre', '[]'), body: null })
    await vi.advanceTimersByTimeAsync(5000)

    expect(saver.getStatus()).toEqual({ kind: 'saved' })
    expect(server.sent.length).toBeGreaterThanOrEqual(2)
    saver.dispose()
  })

  it('annonce le cours renvoyé par le serveur', async () => {
    const server = fakeClient()
    server.reply({ ok: true, status: 200, data: lessonWith('Titre vu du serveur', '[]'), body: null })
    const saver = saverFor(server.client)
    const seen: string[] = []
    saver.onSaved((lesson) => seen.push(lesson.title))

    saver.save('Titre', '[{"type":"text","text":"a"}]')
    await vi.advanceTimersByTimeAsync(SEND_DELAY_MS)

    expect(seen).toEqual(['Titre vu du serveur'])
    saver.dispose()
  })

  it('dit vrai quand tout est enregistré, faux sinon', async () => {
    const server = fakeClient()
    const saver = saverFor(server.client)

    saver.save('Titre', '[{"type":"text","text":"a"}]')
    expect(await saver.flush()).toBe(true)

    server.reply({ ok: false, error: apiError('network', null, 'Serveur injoignable.') })
    saver.save('Titre', '[{"type":"text","text":"b"}]')
    expect(await saver.flush()).toBe(false)
    saver.dispose()
  })

  it('arrête d’envoyer quand le cours a disparu', async () => {
    const server = fakeClient()
    server.reply({ ok: false, error: apiError('not_found', 404, 'Ressource introuvable.') })
    const saver = saverFor(server.client)

    saver.save('Titre', '[{"type":"text","text":"a"}]')
    await vi.advanceTimersByTimeAsync(SEND_DELAY_MS)
    const afterGone = server.sent.length
    saver.save('Titre', '[{"type":"text","text":"b"}]')
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
    saver.save('Titre', '[{"type":"text","text":"a"}]')
    await vi.advanceTimersByTimeAsync(MAX_WAIT_MS)

    expect(server.sent).toHaveLength(0)
  })
})
