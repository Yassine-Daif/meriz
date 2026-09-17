import { describe, expect, it } from 'vitest'
import { apiError } from './apiClient'
import type { ApiErrorKind } from './apiClient'
import type { ApiUser } from './authApi'
import { sessionAfterRestore } from './sessionState'

const user: ApiUser = { id: 1, name: 'Ada', email: 'ada@b.fr', role: 'student', isAcademic: false }

function failure(kind: ApiErrorKind) {
  return sessionAfterRestore({ ok: false, error: apiError(kind, null, '') })
}

describe('restauration de la session au démarrage', () => {
  it('rétablit la session quand le profil est reçu', () => {
    expect(sessionAfterRestore({ ok: true, value: user })).toEqual({
      state: { status: 'signed-in', user },
      clearToken: false,
    })
  })

  it('efface un jeton refusé ou une réponse incompréhensible', () => {
    for (const kind of ['unauthorized', 'forbidden', 'validation', 'unexpected'] as const) {
      expect(failure(kind)).toEqual({ state: { status: 'signed-out' }, clearToken: true })
    }
  })

  it('garde le jeton quand le serveur est injoignable ou débordé', () => {
    for (const kind of ['network', 'server', 'rate_limited'] as const) {
      expect(failure(kind)).toEqual({ state: { status: 'offline' }, clearToken: false })
    }
  })

  it('désactive les comptes sans adresse de serveur', () => {
    expect(failure('not_configured')).toEqual({ state: { status: 'unavailable' }, clearToken: false })
  })
})
