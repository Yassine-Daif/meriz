import type { ApiClient } from '../lib/apiClient'
import type { ApiUser } from '../lib/authApi'
import { ResendVerification } from './ResendVerification'
import { Badge } from './ui/Badge'

interface EmailVerificationSectionProps {
  user: ApiUser
  /** Client lié au compte connecté. */
  client: ApiClient
}

/**
 * L'adresse de connexion et son état de confirmation.
 *
 * Elle vit hors du formulaire de profil : son bouton envoie un courrier,
 * il n'a rien à voir avec l'enregistrement des champs. L'état est porté
 * par un mot, jamais par la seule couleur de la pastille.
 */
export function EmailVerificationSection({ user, client }: EmailVerificationSectionProps) {
  const verified = user.emailVerifiedAt !== null
  return (
    <section
      aria-labelledby="email-titre"
      className="mt-6 rounded-card border border-line bg-surface p-5 shadow-soft sm:p-6"
    >
      <h2 id="email-titre" className="text-lg font-semibold tracking-tight text-ink">
        Adresse email
      </h2>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className="font-mono text-sm text-ink">{user.email}</span>
        <Badge tone={verified ? 'sage' : 'warning'}>
          <span aria-hidden="true">{verified ? '✓' : '!'}</span>
          {verified ? 'Vérifiée' : 'Non vérifiée'}
        </Badge>
      </div>
      {verified ? (
        <p className="mt-2 text-sm leading-6 text-ink-soft">
          Votre adresse est confirmée. Elle sert à vous connecter et à retrouver votre compte.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm leading-6 text-ink-soft">
            Un lien de confirmation vous a été envoyé à la création du compte. S'il ne vous est pas
            parvenu, ou s'il a expiré, demandez-en un nouveau. Pensez à regarder vos indésirables.
          </p>
          <div className="mt-3">
            <ResendVerification client={client} />
          </div>
        </>
      )}
    </section>
  )
}
