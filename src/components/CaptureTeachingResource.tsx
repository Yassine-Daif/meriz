import { useRef, useState } from 'react'
import type { ApiClient } from '../lib/apiClient'
import { captureTeachingResource } from '../lib/teachingLibraryApi'
import type { ResourceKind } from '../lib/teachingLibraryApi'
import { t } from '../i18n/runtime'
import { useLanguage } from '../lib/useLanguage'
import { useToast } from './ui/toastContext'
import { Button } from './ui/Button'
export function CaptureTeachingResource({ client, kind, sourceId, beforeCapture, disabled = false }: { client: ApiClient; kind: ResourceKind; sourceId: string; beforeCapture?: () => Promise<boolean>; disabled?: boolean }) {
  useLanguage()
  const [pending, setPending] = useState(false)
  const busy = useRef(false), toast = useToast()
  async function capture() {
    if (busy.current) return
    busy.current = true; setPending(true)
    try {
      if (beforeCapture && !await beforeCapture()) { toast({ kind: 'error', text: t('Enregistrez les dernières modifications avant de copier cette ressource.') }); return }
      const result = await captureTeachingResource(client, kind, sourceId)
      toast(result.ok ? t('Copie ajoutée à votre bibliothèque dans Mes classes. Vous pouvez la diffuser à plusieurs classes.') : { kind: 'error', text: result.error.message })
    } finally { busy.current = false; setPending(false) }
  }
  return <Button size="sm" disabled={disabled} loading={pending} onClick={() => void capture()}>{t('Ajouter à ma bibliothèque')}</Button>
}
