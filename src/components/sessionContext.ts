import { createContext, useContext } from 'react'
import type { Outcome } from '../lib/apiClient'
import type { AccountSpace } from '../lib/accountController'
import type { ApiUser, Credentials, SignUpData } from '../lib/authApi'
import type { SessionState } from '../lib/sessionState'

export interface SessionContextValue {
  session: SessionState
  /**
   * Espace de documents du moment : local sans compte, cloud du compte
   * connecté, ou état d'attente. Sa clé change à chaque changement de
   * compte, ce qui remonte entièrement l'interface des documents.
   */
  account: AccountSpace
  /** Connexion : le profil en cas de succès, sinon l'erreur à afficher. */
  signIn: (credentials: Credentials) => Promise<Outcome<ApiUser>>
  signUp: (data: SignUpData) => Promise<Outcome<ApiUser>>
  /**
   * Révoque le jeton côté serveur, puis nettoie la session et le cache.
   * Renvoie le nombre de documents dont les modifications sont gardées
   * pour la prochaine connexion de ce compte.
   */
  signOut: () => Promise<number>
  /** Nouvelle tentative de vérification du jeton (serveur injoignable). */
  retry: () => void
  /** Message à annoncer une fois (session expirée, travail mis de côté). */
  notice: string | null
  clearNotice: () => void
  /**
   * Profil enregistré : la session reprend l'utilisateur renvoyé par le
   * serveur, seulement s'il s'agit toujours du compte connecté.
   */
  updateUser: (user: ApiUser) => void
}

export const SessionContext = createContext<SessionContextValue | null>(null)

/** Session de compte courante, disponible partout sous SessionProvider. */
export function useSession(): SessionContextValue {
  const value = useContext(SessionContext)
  if (!value) {
    throw new Error("useSession doit être utilisé à l'intérieur de <SessionProvider>.")
  }
  return value
}
