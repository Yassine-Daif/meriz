import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createAccountController, LOADING_SPACE, LOCAL_SPACE } from '../lib/accountController'
import type { AccountSpace } from '../lib/accountController'
import { createApiClient } from '../lib/apiClient'
import type { Outcome } from '../lib/apiClient'
import { getApiBaseUrl } from '../lib/apiConfig'
import { browserStorage } from '../lib/browserStorage'
import { createCloudCache } from '../lib/cloudCache'
import { fetchCurrentUser, login, logout, register } from '../lib/authApi'
import type { ApiUser, AuthSuccess, Credentials, SignUpData } from '../lib/authApi'
import { sessionAfterRestore } from '../lib/sessionState'
import type { SessionState } from '../lib/sessionState'
import { clearToken, readToken, saveToken } from '../lib/tokenStorage'
import { SessionContext } from './sessionContext'
import type { SessionContextValue } from './sessionContext'

/**
 * Session de compte et espace de documents associé.
 *
 * Au démarrage, un jeton gardé est vérifié auprès du serveur. À chaque
 * connexion et à chaque déconnexion, le cache des documents du cloud
 * est vidé : aucun document d'un compte ne peut apparaître sous un
 * autre. Le travail non envoyé est mis de côté pour son propriétaire.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [baseUrl] = useState(getApiBaseUrl)
  const [session, setSession] = useState<SessionState>(() => {
    if (baseUrl === null) {
      return { status: 'unavailable' }
    }
    return readToken() ? { status: 'restoring' } : { status: 'signed-out' }
  })
  const [account, setAccount] = useState<AccountSpace>(() =>
    baseUrl !== null && readToken() ? LOADING_SPACE : LOCAL_SPACE,
  )
  const [notice, setNotice] = useState<string | null>(null)
  // Chaque « Réessayer » relance la vérification du jeton.
  const [restoreAttempt, setRestoreAttempt] = useState(0)
  // Statut courant hors rendu : les fermetures de session viennent de
  // rappels réseau, jamais d'une mise à jour d'état.
  const statusRef = useRef<SessionState['status']>(session.status)
  const applySession = useCallback((next: SessionState) => {
    statusRef.current = next.status
    setSession(next)
  }, [])

  const stashedNotice = (count: number) =>
    count === 0
      ? null
      : count === 1
        ? "1 document a des modifications non envoyées : elles partiront à votre prochaine connexion sur ce compte."
        : `${count} documents ont des modifications non envoyées : elles partiront à votre prochaine connexion sur ce compte.`

  const [controller] = useState(() => {
    const cache = createCloudCache(browserStorage().storage)
    return createAccountController({
      cache,
      createClient: (getToken, onUnauthorized) =>
        createApiClient({ baseUrl, getToken, onUnauthorized }),
      // Jeton refusé pendant l'usage : plusieurs requêtes peuvent le
      // signaler, la session ne se ferme qu'une fois.
      onExpired: () => {
        if (statusRef.current !== 'signed-in' && statusRef.current !== 'offline') {
          return
        }
        statusRef.current = 'signed-out'
        clearToken()
        const stashed = controller.expired()
        setAccount(LOCAL_SPACE)
        setSession({ status: 'signed-out' })
        setNotice(`Votre session a expiré, reconnectez-vous. ${stashedNotice(stashed) ?? ''}`.trim())
      },
    })
  })

  // Client des appels de compte (inscription, connexion, profil, déconnexion).
  const [client] = useState(() =>
    createApiClient({
      baseUrl,
      getToken: readToken,
      onUnauthorized: () => {
        clearToken()
      },
    }),
  )

  const restoredRef = useRef(false)

  useEffect(() => {
    if (!client.isConfigured) {
      return
    }
    const token = readToken()
    if (token === null) {
      // Aucun compte : aucun cache d'un ancien compte ne doit rester.
      if (!restoredRef.current) {
        restoredRef.current = true
        controller.signedOutAtStartup()
      }
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
        controller.expired()
        setAccount(LOCAL_SPACE)
      } else if (next.state.status === 'signed-in') {
        setAccount(controller.restored(String(next.state.user.id), token))
      } else if (next.state.status === 'offline') {
        setAccount(controller.restoredOffline(token))
      } else {
        setAccount(LOCAL_SPACE)
      }
      applySession(next.state)
    })
    return () => {
      cancelled = true
    }
  }, [client, controller, restoreAttempt, applySession])

  const openSession = useCallback(
    (outcome: Outcome<AuthSuccess>): Outcome<ApiUser> => {
      if (!outcome.ok) {
        return outcome
      }
      const { user, token } = outcome.value
      saveToken(token)
      // Cache vidé puis rechargé pour ce compte, boîte d'envoi reprise.
      setAccount(controller.signedIn(String(user.id), token))
      applySession({ status: 'signed-in', user })
      setNotice(null)
      return { ok: true, value: user }
    },
    [controller, applySession],
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
    // Envoi de ce qui attend, puis révocation, puis nettoyage complet.
    const stashed = await controller.signingOut()
    await logout(client)
    clearToken()
    setAccount(LOCAL_SPACE)
    applySession({ status: 'signed-out' })
    setNotice(stashedNotice(stashed))
    return stashed
  }, [client, controller, applySession])

  const retry = useCallback(() => {
    if (readToken() === null) {
      applySession({ status: 'signed-out' })
      setAccount(LOCAL_SPACE)
      return
    }
    applySession({ status: 'restoring' })
    setAccount(LOADING_SPACE)
    setRestoreAttempt((attempt) => attempt + 1)
  }, [applySession])

  const clearNotice = useCallback(() => setNotice(null), [])

  const value = useMemo<SessionContextValue>(
    () => ({ session, account, signIn, signUp, signOut, retry, notice, clearNotice }),
    [session, account, signIn, signUp, signOut, retry, notice, clearNotice],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
