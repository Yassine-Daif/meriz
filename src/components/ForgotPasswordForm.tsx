import { t } from "../i18n/runtime"
import { useLanguage } from "../lib/useLanguage"
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useSession } from './sessionContext'
import { FormAlert } from './FormAlert'
import { FormField } from './FormField'
import { Button } from './ui/Button'
import { Notice } from './ui/Notice'

interface ForgotPasswordFormProps {
  /** Retour à la connexion, une fois le lien demandé ou abandonné. */
  onSwitchToSignIn: () => void
}

/**
 * Demander un lien de réinitialisation.
 *
 * La réponse du serveur est la même pour une adresse connue et pour une
 * inconnue, et l'application n'ajoute rien qui laisse deviner laquelle
 * des deux. Le message prend la place du formulaire : il n'y a plus rien
 * à faire ici, et rien ne gagne à redemander en boucle.
 */
export function ForgotPasswordForm({ onSwitchToSignIn }: ForgotPasswordFormProps) {
  useLanguage()
  const { requestPasswordReset } = useSession()
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) {
      return
    }
    setPending(true)
    setFormError(null)
    const outcome = await requestPasswordReset(email.trim())
    setPending(false)
    if (outcome.ok) {
      setSent(outcome.value)
      return
    }
    setFormError(outcome.error.message)
    setAttempt((count) => count + 1)
  }

  if (sent !== null) {
    return (
      <div className="flex flex-col gap-4">
        <Notice tone="success">{sent}</Notice>
        <p className="text-sm leading-6 text-ink-soft">
          {t("Le lien ne sert qu'une fois, et il expire au bout d'une heure. Pensez à regarder vos indésirables.")}</p>
        <Button type="button" variant="primary" block onClick={onSwitchToSignIn}>
          {t("Revenir à la connexion")}</Button>
      </div>
    )
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4">
      <FormAlert message={formError} attempt={attempt} />
      <FormField
        label={t("Email")}
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        maxLength={255}
        hint={t("Celui de votre compte Meriz.")}
      />
      <Button type="submit" variant="primary" block loading={pending} loadingLabel={t("Envoi…")}>
        {t("Recevoir un lien")}</Button>
      <p className="text-center text-sm text-ink-soft">
        {t("Vous vous en souvenez ?")}{' '}
        <button
          type="button"
          onClick={onSwitchToSignIn}
          className="font-medium text-accent-ink underline underline-offset-2 hover:text-ink"
        >
          {t("Se connecter")}</button>
      </p>
    </form>
  )
}
