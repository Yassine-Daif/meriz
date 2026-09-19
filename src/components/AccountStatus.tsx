import { useState } from 'react'
import { displayName } from '../lib/authApi'
import { useSession } from './sessionContext'
import { primaryButtonClass, smallButtonClass } from './buttonStyles'

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
          <span className="min-w-0 truncate text-xs text-zinc-700" title={session.user.email}>
            <span aria-hidden="true" className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-600" />
            Connecté : <span className="font-semibold text-ink">{displayName(session.user)}</span>
            {compact ? (
              <span className="sr-only"> ({session.user.email})</span>
            ) : (
              <span className="ml-1.5 font-mono text-[11px] text-zinc-600">{session.user.email}</span>
            )}
          </span>
          {!compact && onShowProfile && (
            <button type="button" onClick={onShowProfile} className={smallButtonClass}>
              Mon profil
            </button>
          )}
          {!compact && onShowClasses && (
            <button type="button" onClick={onShowClasses} className={smallButtonClass}>
              Mes classes
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={pending}
            className={`${smallButtonClass} disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {pending ? 'Envoi et déconnexion…' : 'Se déconnecter'}
          </button>
        </>
      )
      break
    case 'signed-out':
      if (!compact && onShowSignIn && onShowSignUp) {
        content = (
          <>
            <button type="button" onClick={onShowSignIn} className={smallButtonClass}>
              Se connecter
            </button>
            <button
              type="button"
              onClick={onShowSignUp}
              className={`${primaryButtonClass} px-2.5 py-1.5 text-xs`}
            >
              Créer un compte
            </button>
          </>
        )
      }
      break
    case 'offline':
      content = (
        <>
          <span className="text-xs text-zinc-700">
            <span aria-hidden="true">⚠ </span>
            Serveur de comptes injoignable
          </span>
          <button type="button" onClick={retry} className={smallButtonClass}>
            Réessayer
          </button>
        </>
      )
      break
    case 'restoring':
      content = <span className="text-xs text-zinc-600">Connexion au compte…</span>
      break
    case 'unavailable':
      if (!compact) {
        content = (
          <span className="text-xs text-zinc-600" title="Adresse du serveur non configurée (VITE_API_URL)">
            Comptes indisponibles
          </span>
        )
      }
      break
  }

  return (
    <div className="flex min-w-0 items-center gap-2" aria-label="Compte" role="group">
      {content}
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  )
}
