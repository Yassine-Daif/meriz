import { useState } from 'react'
import type { FormEvent } from 'react'
import type { ApiClient } from '../lib/apiClient'
import type { ApiUser } from '../lib/authApi'
import { displayName } from '../lib/authApi'
import { publicPreview, updateProfile } from '../lib/profileApi'
import { useSession } from './sessionContext'
import { FormField } from './FormField'
import { FormAlert } from './FormAlert'
import { PageShell } from './PageShell'
import { ToggleSwitch } from './ToggleSwitch'
import { TeacherModeSection } from './TeacherModeSection'
import { primaryButtonClass } from './buttonStyles'

interface ProfilePageProps {
  user: ApiUser
  /** Client lié au compte connecté. */
  client: ApiClient
  onShowClasses: () => void
}

type Field = 'firstName' | 'name' | 'bio' | 'contact'
const SERVER_FIELD: Record<Field, string> = {
  firstName: 'first_name',
  name: 'name',
  bio: 'bio',
  contact: 'contact',
}

/**
 * Mon profil : prénom, nom, présentation et contact, chacun partagé ou
 * non. L'email de connexion reste privé ; pour être contacté, on remplit
 * le champ Contact et on active son partage.
 */
export function ProfilePage({ user, client, onShowClasses }: ProfilePageProps) {
  const { updateUser } = useSession()
  const [firstName, setFirstName] = useState(user.firstName ?? '')
  const [name, setName] = useState(user.name)
  const [bio, setBio] = useState(user.bio ?? '')
  const [bioShared, setBioShared] = useState(user.bioShared)
  const [contact, setContact] = useState(user.contact ?? '')
  const [contactShared, setContactShared] = useState(user.contactShared)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState('')

  const preview = publicPreview({
    firstName: firstName.trim() === '' ? null : firstName.trim(),
    name: name.trim(),
    bio: bio.trim() === '' ? null : bio.trim(),
    bioShared,
    contact: contact.trim() === '' ? null : contact.trim(),
    contactShared,
  })

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setSaved('')
    setFormError(null)
    setFieldErrors({})
    const outcome = await updateProfile(client, {
      firstName: firstName.trim(),
      name: name.trim(),
      bio: bio.trim() === '' ? null : bio.trim(),
      bioShared,
      contact: contact.trim() === '' ? null : contact.trim(),
      contactShared,
    })
    setPending(false)
    if (outcome.ok) {
      updateUser(outcome.value)
      setSaved('Profil enregistré.')
      return
    }
    const next: Partial<Record<Field, string>> = {}
    for (const [field, serverField] of Object.entries(SERVER_FIELD) as [Field, string][]) {
      const message = outcome.error.fieldErrors[serverField]?.[0]
      if (message) next[field] = message
    }
    setFieldErrors(next)
    setFormError(Object.keys(next).length > 0 ? 'Vérifiez les champs signalés.' : outcome.error.message)
    setAttempt((count) => count + 1)
  }

  return (
    <PageShell title="Mon profil">
      <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-6">
        <FormAlert message={formError} attempt={attempt} />

        <section aria-labelledby="identite-titre" className="rounded-card border border-line bg-surface p-5 shadow-soft sm:p-6">
          <h2 id="identite-titre" className="text-lg font-semibold tracking-tight text-ink">
            Identité
          </h2>
          <p className="mt-1 text-xs text-ink-soft">Votre prénom et votre nom sont visibles par les membres de vos classes.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <FormField
              label="Prénom"
              type="text"
              value={firstName}
              onChange={setFirstName}
              autoComplete="given-name"
              maxLength={100}
              error={fieldErrors.firstName}
            />
            <FormField
              label="Nom"
              type="text"
              value={name}
              onChange={setName}
              autoComplete="family-name"
              maxLength={100}
              error={fieldErrors.name}
            />
          </div>
        </section>

        <section aria-labelledby="partage-titre" className="rounded-card border border-line bg-surface p-5 shadow-soft sm:p-6">
          <h2 id="partage-titre" className="text-lg font-semibold tracking-tight text-ink">
            Présentation et contact
          </h2>
          <p className="mt-2 rounded-control bg-accent-soft px-4 py-3 text-sm leading-6 text-ink">
            Votre email de connexion (<span className="font-mono">{user.email}</span>) reste privé :
            il n'est jamais montré aux autres. Pour qu'on puisse vous joindre, indiquez une adresse
            dans « Contact » et activez son partage. Rien n'est partagé tant que vous ne l'activez
            pas.
          </p>

          <div className="mt-4 flex flex-col gap-4">
            <FormField
              label="Présentation"
              type="text"
              value={bio}
              onChange={setBio}
              autoComplete="off"
              multiline
              required={false}
              maxLength={280}
              hint="Quelques mots sur vous, visibles par vos classes si vous les partagez."
              error={fieldErrors.bio}
            />
            <ToggleSwitch
              label="Partager ma présentation"
              description="Visible par le prof et les membres de vos classes."
              checked={bioShared}
              onChange={setBioShared}
            />

            <FormField
              label="Contact"
              type="text"
              value={contact}
              onChange={setContact}
              autoComplete="off"
              required={false}
              maxLength={255}
              hint="Une adresse où l'on peut vous écrire, différente de votre email de connexion si vous le souhaitez."
              error={fieldErrors.contact}
            />
            <ToggleSwitch
              label="Partager mon contact"
              description="Visible par le prof et les membres de vos classes."
              checked={contactShared}
              onChange={setContactShared}
            />
          </div>
        </section>

        <section aria-labelledby="apercu-titre" className="rounded-card border border-dashed border-line-strong bg-surface-soft p-5 sm:p-6">
          <h2 id="apercu-titre" className="text-lg font-semibold tracking-tight text-ink">
            Ce que voient les autres
          </h2>
          <dl className="mt-2 grid gap-1 text-sm">
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-ink-soft">Nom</dt>
              <dd>{displayName(preview) || '(vide)'}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-ink-soft">Présentation</dt>
              <dd>{preview.bio ?? <span className="text-ink-soft">non partagée</span>}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-ink-soft">Contact</dt>
              <dd>{preview.contact ?? <span className="text-ink-soft">non partagé</span>}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-ink-soft">
            Aperçu de vos réglages en cours. Ils s'appliquent une fois enregistrés.
          </p>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pending} className={primaryButtonClass}>
            {pending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <p role="status" aria-live="polite" className="text-sm text-ink-soft">
            {saved && (
              <>
                <span aria-hidden="true">✓ </span>
                {saved}
              </>
            )}
          </p>
        </div>
      </form>

      <TeacherModeSection user={user} client={client} onShowClasses={onShowClasses} />
    </PageShell>
  )
}
