import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { ApiUser } from '../lib/authApi'
import { useSession } from './sessionContext'
import { FormField } from './FormField'
import { FormAlert } from './FormAlert'
import { primaryButtonClass } from './buttonStyles'

interface SignUpFormProps {
  onSuccess: (user: ApiUser) => void
  onSwitchToSignIn: () => void
}

type Field = 'firstName' | 'name' | 'email' | 'password'
const FIELDS: readonly Field[] = ['firstName', 'name', 'email', 'password']
/** Nom des champs côté serveur, pour relier ses erreurs au bon champ. */
const SERVER_FIELD: Record<Field, string> = {
  firstName: 'first_name',
  name: 'name',
  email: 'email',
  password: 'password',
}

/**
 * Inscription neutre : prénom, nom, email, mot de passe, et rien d'autre.
 * Le rôle et le statut scolaire sont décidés par le serveur.
 */
export function SignUpForm({ onSuccess, onSwitchToSignIn }: SignUpFormProps) {
  const { signUp } = useSession()
  const [values, setValues] = useState<Record<Field, string>>({ firstName: '', name: '', email: '', password: '' })
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({})
  const [pending, setPending] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const firstNameRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  // Après un refus du serveur, le focus va au premier champ en erreur.
  const firstInvalid = FIELDS.find((field) => fieldErrors[field])
  useEffect(() => {
    if (attempt === 0 || !firstInvalid) {
      return
    }
    const target = { firstName: firstNameRef, name: nameRef, email: emailRef, password: passwordRef }[firstInvalid]
    target.current?.focus()
  }, [attempt, firstInvalid, firstNameRef, nameRef, emailRef, passwordRef])

  const setValue = (field: Field) => (value: string) =>
    setValues((previous) => ({ ...previous, [field]: value }))

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) {
      return
    }
    setPending(true)
    setFormError(null)
    setFieldErrors({})
    const outcome = await signUp({
      firstName: values.firstName.trim(),
      name: values.name.trim(),
      email: values.email.trim(),
      password: values.password,
    })
    setPending(false)
    if (outcome.ok) {
      onSuccess(outcome.value)
      return
    }
    const { error } = outcome
    const nextFieldErrors: Partial<Record<Field, string>> = {}
    for (const field of FIELDS) {
      const messages = error.fieldErrors[SERVER_FIELD[field]]
      if (messages?.[0]) {
        nextFieldErrors[field] = messages[0]
      }
    }
    setFieldErrors(nextFieldErrors)
    // Une erreur sans champ connu (réseau, limite, serveur) va dans l'alerte générale.
    setFormError(Object.keys(nextFieldErrors).length > 0 ? null : error.message)
    setAttempt((count) => count + 1)
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4">
      <FormAlert message={formError} attempt={attempt} />
      <FormField
        label="Prénom"
        type="text"
        value={values.firstName}
        onChange={setValue('firstName')}
        autoComplete="given-name"
        maxLength={100}
        error={fieldErrors.firstName}
        inputRef={firstNameRef}
      />
      <FormField
        label="Nom"
        type="text"
        value={values.name}
        onChange={setValue('name')}
        autoComplete="family-name"
        maxLength={100}
        error={fieldErrors.name}
        inputRef={nameRef}
      />
      <FormField
        label="Email"
        type="email"
        value={values.email}
        onChange={setValue('email')}
        autoComplete="email"
        maxLength={255}
        error={fieldErrors.email}
        inputRef={emailRef}
      />
      <FormField
        label="Mot de passe"
        type="password"
        value={values.password}
        onChange={setValue('password')}
        autoComplete="new-password"
        hint="8 caractères minimum."
        minLength={8}
        maxLength={72}
        error={fieldErrors.password}
        inputRef={passwordRef}
      />
      <button type="submit" disabled={pending} className={`${primaryButtonClass} w-full`}>
        {pending ? 'Création du compte…' : 'Créer mon compte'}
      </button>
      <p className="text-center text-sm text-ink-soft">
        Déjà un compte ?{' '}
        <button
          type="button"
          onClick={onSwitchToSignIn}
          className="font-medium text-accent-ink underline underline-offset-2 hover:text-ink"
        >
          Se connecter
        </button>
      </p>
    </form>
  )
}
