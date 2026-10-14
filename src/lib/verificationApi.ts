import type { ApiClient, Outcome } from './apiClient'
import { unexpectedResponse } from './apiClient'

/**
 * Renvoi du lien de vérification d'email, pour son propre compte.
 *
 * Le serveur distingue ses deux réussites par le statut : 202 quand le
 * courrier part, 200 quand l'adresse était déjà confirmée. Au-delà du
 * quota il répond 429, que le client transforme déjà en erreur de genre
 * `rate_limited`, avec son délai.
 */

export interface ResendOutcome {
  state: 'sent' | 'already'
  /** Le message du serveur, affiché tel quel. */
  message: string
}

const SENT = 'Lien de vérification envoyé.'
const ALREADY = 'Cet email est déjà vérifié.'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function resendVerification(client: ApiClient): Promise<Outcome<ResendOutcome>> {
  const result = await client.request('POST', '/auth/email/verification-notification')
  if (!result.ok) {
    return result
  }
  if (result.status !== 200 && result.status !== 202) {
    return { ok: false, error: unexpectedResponse(result.status) }
  }
  const state = result.status === 202 ? 'sent' : 'already'
  const raw = isRecord(result.data) ? result.data.message : undefined
  const message = typeof raw === 'string' && raw.trim() !== '' ? raw : state === 'sent' ? SENT : ALREADY
  return { ok: true, value: { state, message } }
}
