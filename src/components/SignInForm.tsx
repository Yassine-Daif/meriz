import { useState } from 'react'
import type { FormEvent } from 'react'
import type { ApiUser } from '../lib/authApi'
import { useSession } from './sessionContext'
import { FormField } from './FormField'
import { FormAlert } from './FormAlert'
import { primaryButtonClass } from './buttonStyles'

interface SignInFormProps {
  onSuccess: (user: ApiUser) => void
  onSwitchToSignUp: () => void
}

/** Message unique : on ne révèle jamais si l'email ou le mot de passe est en cause. */
const WRONG_CREDENTIALS = 'Email ou mot de passe incorrect.'

/** Connexion par email et mot de passe. */
export function SignInForm({ onSuccess, onSwitchToSignUp }: SignInFormProps) {
  const { signIn } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) {
      return
    }
    setPending(true)
    setFormError(null)
    const outcome = await signIn({ email: email.trim(), password })
    setPending(false)
    if (outcome.ok) {
      onSuccess(outcome.value)
      return
    }
    setFormError(outcome.error.kind === 'validation' ? WRONG_CREDENTIALS : outcome.error.message)
    setAttempt((count) => count + 1)
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4">
      <FormAlert message={formError} attempt={attempt} />
      <FormField
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        maxLength={255}
      />
      <FormField
        label="Mot de passe"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
        maxLength={255}
      />
      <button type="submit" disabled={pending} className={`${primaryButtonClass} w-full`}>
        {pending ? 'Connexion…' : 'Se connecter'}
      </button>
      <p className="text-center text-sm text-ink-soft">
        Pas encore de compte ?{' '}
        <button
          type="button"
          onClick={onSwitchToSignUp}
          className="font-medium text-accent-ink underline underline-offset-2 hover:text-ink"
        >
          Créer un compte
        </button>
      </p>
    </form>
  )
}
