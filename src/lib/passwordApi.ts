import { t } from "../i18n/runtime"
import type { ApiClient, Outcome } from './apiClient'
import { unexpectedResponse } from './apiClient'
import type { PasswordResetLink } from './passwordResetLanding'

/**
 * Mot de passe oublié, en deux temps : demander un lien, puis poser un
 * nouveau mot de passe avec le jeton reçu.
 *
 * Les deux routes sont publiques, car il n'y a par définition pas de
 * session quand on a perdu son mot de passe.
 */

/** Réponse de la demande : le serveur ne dit jamais si l'adresse existe. */
const GENERIC = 'Si un compte existe pour cette adresse, un lien de réinitialisation vient de partir.'

const DONE = 'Votre mot de passe a été réinitialisé.'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Le message du serveur, ou un repli de même sens s'il n'en donne pas. */
function message(data: unknown, repli: string): string {
  const raw = isRecord(data) ? data.message : undefined
  return typeof raw === 'string' && raw.trim() !== '' ? raw : repli
}

/**
 * Demande un lien de réinitialisation. La réponse est volontairement la
 * même pour une adresse connue et pour une inconnue.
 */
export async function requestPasswordReset(client: ApiClient, email: string): Promise<Outcome<string>> {
  const result = await client.request('POST', '/auth/password/forgot', { email })
  if (!result.ok) {
    return result
  }
  return { ok: true, value: message(result.data, t(GENERIC)) }
}

export interface NewPassword extends PasswordResetLink {
  password: string
}

/**
 * Pose le nouveau mot de passe. Le serveur ne rend aucun jeton de
 * session, et c'est voulu : un lien reçu par courrier ne doit pas
 * suffire à ouvrir une session. On repasse donc par la connexion.
 *
 * Un lien périmé, déjà utilisé, falsifié, ou dont l'adresse ne
 * correspond pas, revient en erreur de validation sur le champ `token`.
 */
export async function resetPassword(client: ApiClient, data: NewPassword): Promise<Outcome<string>> {
  const result = await client.request('POST', '/auth/password/reset', {
    token: data.token,
    email: data.email,
    password: data.password,
  })
  if (!result.ok) {
    return result
  }
  if (result.status !== 200) {
    return { ok: false, error: unexpectedResponse(result.status) }
  }
  return { ok: true, value: message(result.data, t(DONE)) }
}
