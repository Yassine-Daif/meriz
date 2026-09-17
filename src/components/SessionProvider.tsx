import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { createApiClient } from '../lib/apiClient'
import type { Outcome } from '../lib/apiClient'
import { getApiBaseUrl } from '../lib/apiConfig'
import { fetchCurrentUser, login, logout, register } from '../lib/authApi'
import type { ApiUser, AuthSuccess, Credentials, SignUpData } from '../lib/authApi'
import { sessionAfterRestore } from '../lib/sessionState'
import type { SessionState } from '../lib/sessionState'
import { clearToken, readToken, saveToken } from '../lib/tokenStorage'
import { SessionContext } from './sessionContext'
import type { SessionContextValue } from './sessionContext'

/**
 * Session de compte partagée par toute l'application. Au démarrage,
 * un jeton gardé est vérifié auprès du serveur pour rétablir la
 * session. Sans adresse de serveur, les comptes sont désactivés.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [baseUrl] = useState(getApiBaseUrl)
  const [session, setSession] = useState<SessionState>(() => {
    if (baseUrl === null) {
      return { status: 'unavailable' }
    }
    return readToken() ? { status: 'restoring' } : { status: 'signed-out' }
  })
  // Chaque « Réessayer » relance la vérification du jeton.
  const [restoreAttempt, setRestoreAttempt] = useState(0)

  const [client] = useState(() =>
    createApiClient({
      baseUrl,
      getToken: readToken,
      // Jeton refusé à n'importe quel appel : retour à l'état déconnecté.
      onUnauthorized: () => {
        clearToken()
        setSession({ status: 'signed-out' })
      },
    }),
  )

  useEffect(() => {
    if (!client.isConfigured || readToken() === null) {
      return
    }
    let cancelled = false
    void fetchCurrentUser(client).then((outcome) => {
      if (cancelled) {
        return
      }
      const next = sessionAfterRestore(outcome)
      if (next.clearToken) {
        clearToken()
      }
      setSession(next.state)
    })
    return () => {
      cancelled = true
    }
  }, [client, restoreAttempt])

  const openSession = useCallback(
    (outcome: Outcome<AuthSuccess>): Outcome<ApiUser> => {
      if (!outcome.ok) {
        return outcome
      }
      saveToken(outcome.value.token)
      setSession({ status: 'signed-in', user: outcome.value.user })
      return { ok: true, value: outcome.value.user }
    },
    [],
  )

  const signIn = useCallback(
    async (credentials: Credentials) => openSession(await login(client, credentials)),
    [client, openSession],
  )

  const signUp = useCallback(
    async (data: SignUpData) => openSession(await register(client, data)),
    [client, openSession],
  )

  const signOut = useCallback(async () => {
    // Le serveur révoque le jeton ; même injoignable, on nettoie ici.
    await logout(client)
    clearToken()
    setSession({ status: 'signed-out' })
  }, [client])

  const retry = useCallback(() => {
    if (readToken() === null) {
      setSession({ status: 'signed-out' })
      return
    }
    setSession({ status: 'restoring' })
    setRestoreAttempt((attempt) => attempt + 1)
  }, [])

  const value = useMemo<SessionContextValue>(
    () => ({ session, signIn, signUp, signOut, retry }),
    [session, signIn, signUp, signOut, retry],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
