import { useCallback, useSyncExternalStore } from 'react'
import { useSession } from './sessionContext'
import { updateProfile } from '../lib/profileApi'
import { readLocalMode, setLocalMode, subscribeLocalMode } from '../lib/interfaceMode'
import type { InterfaceMode } from '../lib/interfaceMode'
import { t } from '../i18n/runtime'

/** Le choix du compte prime ; une préférence anonyme ne l'écrase jamais. */
export function useInterfaceMode() {
  const { session, account, updateUser } = useSession()
  const local = useSyncExternalStore(subscribeLocalMode, readLocalMode, () => null)
  const user = session.status === 'signed-in' ? session.user : null
  const mode = user ? user.interfaceMode ?? null : local
  const choose = useCallback(async (next: InterfaceMode): Promise<string | null> => {
    if (user) {
      if (account.kind !== 'cloud') return t('Reconnectez-vous pour enregistrer votre préférence dans votre compte.')
      const outcome = await updateProfile(account.client, { interfaceMode: next })
      if (!outcome.ok) return outcome.error.message
      updateUser(outcome.value)
    } else { setLocalMode(next) }
    return null
  }, [user, account, updateUser])
  return { mode, choose, category: user?.usageCategory ?? null }
}
