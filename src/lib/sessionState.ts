import type { Outcome } from './apiClient'
import type { ApiUser } from './authApi'

/**
 * État de la session de compte. Les documents restent locaux quel que
 * soit cet état : l'application marche aussi sans compte.
 */
export type SessionState =
  /** Adresse du serveur non configurée : comptes désactivés. */
  | { status: 'unavailable' }
  /** Jeton présent, profil en cours de vérification. */
  | { status: 'restoring' }
  | { status: 'signed-out' }
  /** Jeton conservé, mais serveur injoignable pour le vérifier. */
  | { status: 'offline' }
  | { status: 'signed-in'; user: ApiUser }

/**
 * Issue de la vérification du jeton au démarrage. Un jeton refusé ou
 * une réponse incompréhensible sont effacés. Un serveur injoignable ne
 * prouve rien contre le jeton : il est gardé pour réessayer.
 */
export function sessionAfterRestore(outcome: Outcome<ApiUser>): {
  state: SessionState
  clearToken: boolean
} {
  if (outcome.ok) {
    return { state: { status: 'signed-in', user: outcome.value }, clearToken: false }
  }
  switch (outcome.error.kind) {
    case 'network':
    case 'server':
    case 'rate_limited':
      return { state: { status: 'offline' }, clearToken: false }
    case 'not_configured':
      return { state: { status: 'unavailable' }, clearToken: false }
    case 'unauthorized':
    case 'forbidden':
    case 'validation':
    case 'unexpected':
      return { state: { status: 'signed-out' }, clearToken: true }
  }
}
