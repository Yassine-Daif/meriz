import { t } from "../i18n/runtime"
import { useLanguage } from "../lib/useLanguage"
import { useState } from 'react'
import type { ApiClient } from '../lib/apiClient'
import { fetchCurrentUser } from '../lib/authApi'
import { resendVerification } from '../lib/verificationApi'
import { useSession } from './sessionContext'
import { Button } from './ui/Button'
import { Notice } from './ui/Notice'

interface ResendVerificationProps {
  /** Client lié au compte connecté : le renvoi vaut pour soi seul. */
  client: ApiClient
  label?: string
  variant?: 'primary' | 'secondary'
}

/**
 * Demander un nouveau lien de confirmation.
 *
 * Trois réponses possibles, et un message pour chacune : le lien part,
 * l'adresse était déjà confirmée, ou le quota du serveur est atteint.
 * Le texte vient du serveur, l'application ne le réécrit pas.
 */
export function ResendVerification({
  client,
  label = t("Renvoyer le lien"),
  variant = 'secondary',
}: ResendVerificationProps) {
  useLanguage()
  const { updateUser } = useSession()
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'success' | 'warning' | 'error'; text: string } | null>(null)

  const send = async () => {
    if (pending) return
    setPending(true)
    setNotice(null)
    const outcome = await resendVerification(client)
    if (!outcome.ok) {
      setNotice({ tone: outcome.error.kind === 'rate_limited' ? 'warning' : 'error', text: outcome.error.message })
      setPending(false)
      return
    }
    if (outcome.value.state === 'already') {
      // L'adresse est confirmée depuis un autre appareil : on relit le
      // compte, pour que l'écran cesse aussitôt de la réclamer.
      const me = await fetchCurrentUser(client)
      if (me.ok) updateUser(me.value)
    }
    setNotice({ tone: 'success', text: outcome.value.message })
    setPending(false)
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <Button
        type="button"
        variant={variant}
        onClick={() => void send()}
        loading={pending}
        loadingLabel={t("Envoi…")}
      >
        {label}
      </Button>
      {notice && (
        <Notice tone={notice.tone} className="w-full">
          {notice.text}
        </Notice>
      )}
    </div>
  )
}
