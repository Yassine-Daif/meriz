import { DesktopUpdateButton } from './DesktopUpdates'
import { useState } from 'react'
import { displayName } from '../lib/authApi'
import { useSession } from './sessionContext'
import { Avatar } from './ui/Avatar'
import { Button } from './ui/Button'


interface AccountStatusProps {
  /** Version barre d'éditeur : n'affiche rien tant qu'on n'est pas connecté. */
  compact?: boolean
  onShowSignIn?: () => void
  onShowSignUp?: () => void
  /** Accueil, une fois connecté : accès au profil et aux classes. */
  onShowProfile?: () => void
  onShowClasses?: () => void
}

/**
 * État du compte, visible dans les en-têtes : connecté (avec
 * déconnexion), boutons de connexion, serveur injoignable, ou comptes
 * indisponibles. Les changements sont annoncés aux lecteurs d'écran.
 */
export function AccountStatus({
  compact = false,
  onShowSignIn,
  onShowSignUp,
  onShowProfile,
  onShowClasses,
}: AccountStatusProps) {
  const { session, signOut, retry } = useSession()
  const [pending, setPending] = useState(false)
  const [announcement, setAnnouncement] = useState('')

  const handleSignOut = async () => {
    setPending(true)
    const stashed = await signOut()
    setPending(false)
    setAnnouncement(
      stashed === 0
        ? 'Vous êtes déconnecté. Vos documents de ce compte sont enregistrés.'
        : `Vous êtes déconnecté. ${stashed} document${stashed > 1 ? 's ont' : ' a'} des modifications gardées pour votre prochaine connexion.`,
    )
  }

  let content = null
  switch (session.status) {
    case 'signed-in':
      content = (
        <>
          <Avatar person={session.user} size="sm" />
          <span className="min-w-0 truncate text-sm text-ink-soft" title={session.user.email}>
            <span className="font-semibold text-ink">{displayName(session.user)}</span>
            {compact ? (
              <span className="sr-only"> ({session.user.email})</span>
            ) : (
              <span className="ml-1.5 font-mono text-xs text-ink-soft">{session.user.email}</span>
            )}
          </span>
          {!compact && onShowProfile && (
            <Button type="button" size="sm" onClick={onShowProfile}>
              Mon profil
            </Button>
          )}
          {!compact && onShowClasses && (
            <Button type="button" size="sm" onClick={onShowClasses}>
              Mes classes
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={() => void handleSignOut()}
            loading={pending}
            loadingLabel="Envoi et déconnexion…"
          >
            Se déconnecter
          </Button>
        </>
      )
      break
    case 'signed-out':
      if (!compact && onShowSignIn && onShowSignUp) {
        content = (
          <>
            <Button type="button" size="sm" onClick={onShowSignIn}>
              Se connecter
            </Button>
            <Button type="button" size="sm" variant="primary" onClick={onShowSignUp}>
              Créer un compte
            </Button>
          </>
        )
      }
      break
    case 'offline':
      content = (
        <>
          <span className="text-sm text-ink-soft">
            <span aria-hidden="true">⚠ </span>
            Serveur de comptes injoignable
          </span>
          <Button type="button" size="sm" onClick={retry}>
            Réessayer
          </Button>
        </>
      )
      break
    case 'restoring':
      content = <span className="text-sm text-ink-soft">Connexion au compte…</span>
      break
    case 'unavailable':
      if (!compact) {
        content = (
          <span className="text-sm text-ink-soft" title="Adresse du serveur non configurée (VITE_API_URL)">
            Comptes indisponibles
          </span>
        )
      }
      break
  }

  return (
    <div className="flex min-w-0 items-center gap-2" aria-label="Compte" role="group">
      <DesktopUpdateButton />
      {content}
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  )
}
