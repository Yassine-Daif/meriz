import { useEffect, useRef } from 'react'
import type { ApiClient } from '../lib/apiClient'
import { fetchCurrentUser } from '../lib/authApi'
import type { VerificationResult } from '../lib/verificationLanding'
import { ResendVerification } from './ResendVerification'
import { useSession } from './sessionContext'
import { Button } from './ui/Button'
import { Notice } from './ui/Notice'
import { PublicShell } from './ui/PublicShell'

interface EmailVerifiedPageProps {
  result: VerificationResult
  /** Continuer vers l'application, et effacer le résultat de l'adresse. */
  onContinue: () => void
  /** Aller se connecter, quand le renvoi demande un compte ouvert. */
  onSignIn: () => void
}

const MESSAGES: Record<VerificationResult, { title: string; tone: 'success' | 'warning'; text: string }> = {
  success: {
    title: 'Adresse confirmée',
    tone: 'success',
    text: 'Votre adresse email est confirmée. Votre compte est au complet, vous pouvez continuer.',
  },
  already: {
    title: 'Adresse déjà confirmée',
    tone: 'success',
    text: 'Cette adresse était déjà confirmée. Il n’y a rien de plus à faire.',
  },
  expired: {
    title: 'Lien expiré',
    tone: 'warning',
    text: 'Ce lien avait une durée de vie, et elle est passée. Demandez-en un nouveau, il arrive tout de suite.',
  },
  invalid: {
    title: 'Lien inutilisable',
    tone: 'warning',
    text: 'Ce lien n’a pas pu être lu. Il a souvent été coupé en chemin par le logiciel de messagerie. Demandez-en un nouveau.',
  },
}

/**
 * Le retour d'un lien de confirmation d'adresse.
 *
 * Cette page s'ouvre depuis une boîte mail, donc souvent sans session et
 * parfois depuis un autre appareil : elle n'exige jamais d'être
 * connecté. Le renvoi d'un lien, lui, vaut pour son propre compte, donc
 * il demande une session ouverte.
 */
export function EmailVerifiedPage({ result, onContinue, onSignIn }: EmailVerifiedPageProps) {
  const { session, account, updateUser } = useSession()
  const message = MESSAGES[result]
  const confirmed = result === 'success' || result === 'already'
  // Le renvoi vaut pour son propre compte : il lui faut le client lié au
  // jeton ouvert, que seul l'espace cloud porte.
  const client: ApiClient | null =
    session.status === 'signed-in' && account.kind === 'cloud' ? account.client : null
  const refreshed = useRef(false)

  /*
   * Confirmation reçue sur l'appareil où la session est ouverte : on
   * relit le compte, pour que le profil et le mode prof le sachent sans
   * rechargement.
   */
  useEffect(() => {
    if (!confirmed || client === null || refreshed.current) {
      return
    }
    refreshed.current = true
    void fetchCurrentUser(client).then((outcome) => {
      if (outcome.ok) updateUser(outcome.value)
    })
  }, [confirmed, client, updateUser])

  return (
    <PublicShell title={message.title} focusKey={result}>
      <div className="flex flex-col gap-5">
        <Notice tone={message.tone} announce={false}>
          {message.text}
        </Notice>

        {confirmed ? (
          <div>
            <Button type="button" variant="primary" onClick={onContinue}>
              Continuer vers Meriz
            </Button>
          </div>
        ) : client !== null ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm leading-6 text-ink-soft">
              Vous êtes connecté : demandez un nouveau lien, il partira vers votre adresse.
            </p>
            <ResendVerification client={client} variant="primary" label="Recevoir un nouveau lien" />
            <div>
              <Button type="button" onClick={onContinue}>
                Continuer vers Meriz
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm leading-6 text-ink-soft">
              Pour recevoir un nouveau lien, connectez-vous, puis relancez l'envoi depuis votre
              profil, section Adresse email.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="primary" onClick={onSignIn}>
                Se connecter
              </Button>
              <Button type="button" onClick={onContinue}>
                Continuer sans compte
              </Button>
            </div>
          </div>
        )}
      </div>
    </PublicShell>
  )
}
