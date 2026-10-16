import { useState } from 'react'
import type { FormEvent } from 'react'
import type { PasswordResetLink } from '../lib/passwordResetLanding'
import { useSession } from './sessionContext'
import { FormAlert } from './FormAlert'
import { FormField } from './FormField'
import { Button } from './ui/Button'
import { Notice } from './ui/Notice'
import { PublicShell } from './ui/PublicShell'

interface NewPasswordPageProps {
  link: PasswordResetLink
  /** Aller se connecter, avec l'adresse du lien déjà posée. */
  onSignIn: (email: string) => void
  /** Redemander un lien, quand celui-ci ne vaut plus rien. */
  onAskNewLink: () => void
  /** Continuer sans compte : le lien est abandonné. */
  onContinue: () => void
}

const TROP_COURT = '8 caractères minimum.'
const DIFFERENT = 'Les deux mots de passe ne sont pas identiques.'

/**
 * Choisir un nouveau mot de passe, depuis le lien reçu par courrier.
 *
 * La page est publique : on arrive ici sans session, et souvent depuis
 * un autre appareil. Le serveur n'ouvre aucune session au succès, et
 * c'est voulu : un lien de courrier ne doit pas suffire à entrer. On
 * repasse donc par la connexion, ce qui fait retaper le mot de passe
 * une fois.
 */
export function NewPasswordPage({ link, onSignIn, onAskNewLink, onContinue }: NewPasswordPageProps) {
  const { resetPassword } = useSession()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string | undefined>(undefined)
  const [attempt, setAttempt] = useState(0)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) {
      return
    }
    // La concordance se vérifie ici : le serveur ne la demande pas, et
    // la confirmation ne part jamais sur le réseau.
    if (password.length < 8) {
      setFieldError(undefined)
      setFormError(TROP_COURT)
      setAttempt((count) => count + 1)
      return
    }
    if (password !== confirmation) {
      setFormError(null)
      setFieldError(DIFFERENT)
      return
    }
    setPending(true)
    setFormError(null)
    setFieldError(undefined)
    const outcome = await resetPassword({ ...link, password })
    setPending(false)
    if (outcome.ok) {
      setDone(outcome.value)
      return
    }
    const refus = outcome.error.fieldErrors.token?.[0]
    if (refus === undefined) {
      setFormError(outcome.error.fieldErrors.password?.[0] ?? outcome.error.message)
      setAttempt((count) => count + 1)
      return
    }
    setLinkError(refus)
  }

  if (done !== null) {
    return (
      <PublicShell title="Mot de passe changé" focusKey="done">
        <div className="flex flex-col gap-4">
          <Notice tone="success" announce={false}>
            {done}
          </Notice>
          <p className="text-sm leading-6 text-ink-soft">
            Toutes vos sessions ont été fermées, y compris sur vos autres appareils. Connectez-vous
            avec votre nouveau mot de passe.
          </p>
          <Button type="button" variant="primary" block onClick={() => onSignIn(link.email)}>
            Se connecter
          </Button>
        </div>
      </PublicShell>
    )
  }

  if (linkError !== null) {
    return (
      <PublicShell title="Lien inutilisable" focusKey="refus">
        <div className="flex flex-col gap-4">
          <Notice tone="warning" announce={false}>
            {linkError}
          </Notice>
          <p className="text-sm leading-6 text-ink-soft">
            Un lien de réinitialisation ne sert qu'une fois, et il expire au bout d'une heure. Il
            suffit d'en demander un nouveau.
          </p>
          <Button type="button" variant="primary" block onClick={onAskNewLink}>
            Demander un nouveau lien
          </Button>
          <Button type="button" block onClick={onContinue}>
            Continuer sans compte
          </Button>
        </div>
      </PublicShell>
    )
  }

  return (
    <PublicShell
      title="Nouveau mot de passe"
      lede={`Pour le compte ${link.email}.`}
      focusKey="form"
    >
      <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4">
        <FormAlert message={formError} attempt={attempt} />
        <FormField
          label="Nouveau mot de passe"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          hint={TROP_COURT}
          minLength={8}
          maxLength={72}
        />
        <FormField
          label="Confirmer le mot de passe"
          type="password"
          value={confirmation}
          onChange={(value) => {
            setConfirmation(value)
            setFieldError(undefined)
          }}
          autoComplete="new-password"
          error={fieldError}
          maxLength={72}
        />
        <Button type="submit" variant="primary" block loading={pending} loadingLabel="Enregistrement…">
          Changer mon mot de passe
        </Button>
      </form>
    </PublicShell>
  )
}
