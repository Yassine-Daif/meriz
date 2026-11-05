import { useEffect, useState } from 'react'
import type { ApiClient } from '../lib/apiClient'
import { parseAssignmentInterface } from '../lib/assignmentInterface'
import type { AssignmentInterface } from '../lib/assignmentInterface'
import { t } from '../i18n/runtime'

interface Snapshot { key: string; loaded: boolean; settings: AssignmentInterface | null; error: string | null }
export function useAssignmentInterface(client: ApiClient | null, assignmentId: string | null, accountKey: string) {
  const key = accountKey + ':' + assignmentId
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [attempt, retry] = useState(0)
  useEffect(() => {
    if (!client || !assignmentId) return
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    async function refresh() {
      try {
        const result = await client!.request('GET', '/assignments/' + encodeURIComponent(assignmentId!) + '/interface-settings')
        if (!active) return
        const raw: unknown = result.ok ? result.data : undefined
        const settings = raw && typeof raw === 'object' && 'interface_settings' in raw ? parseAssignmentInterface(raw.interface_settings) : undefined
        if (result.ok && settings !== undefined) {
          setSnapshot({ key, loaded: true, settings, error: null })
        } else {
          const error = result.ok ? t('Réglages de l’exercice invalides. Réessayez.') : result.error.message
          setSnapshot(previous => previous?.key === key && previous.loaded ? { ...previous, error } : { key, loaded: false, settings: null, error })
        }
      } catch {
        if (active) setSnapshot(previous => ({ key, loaded: previous?.key === key && previous.loaded, settings: previous?.key === key ? previous.settings : null, error: t('Impossible de vérifier les réglages de l’exercice.') }))
      } finally {
        if (active) timer = setTimeout(() => { void refresh() }, 10000)
      }
    }
    void refresh()
    return () => { active = false; clearTimeout(timer) }
  }, [client, assignmentId, key, attempt])
  return {
    loading: !!assignmentId && (!snapshot || snapshot.key !== key || !snapshot.loaded),
    settings: assignmentId && snapshot?.key === key ? snapshot.settings : null,
    error: assignmentId && snapshot?.key === key ? snapshot.error : null,
    retry: () => retry(value => value + 1),
  }
}
