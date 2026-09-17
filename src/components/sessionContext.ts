import { createContext, useContext } from 'react'
import type { Outcome } from '../lib/apiClient'
import type { ApiUser, Credentials, SignUpData } from '../lib/authApi'
import type { SessionState } from '../lib/sessionState'

export interface SessionContextValue {
  session: SessionState
  /** Connexion : le profil en cas de succès, sinon l'erreur à afficher. */
  signIn: (credentials: Credentials) => Promise<Outcome<ApiUser>>
  signUp: (data: SignUpData) => Promise<Outcome<ApiUser>>
  /** Révoque le jeton côté serveur, puis nettoie la session locale. */
  signOut: () => Promise<void>
  /** Nouvelle tentative de vérification du jeton (serveur injoignable). */
  retry: () => void
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
