import { t } from "../i18n/runtime"
import { useLanguage } from "../lib/useLanguage"
import { Icon } from './ui/Icon'
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
  useLanguage()
  const { session, signOut, retry } = useSession()
  const [pending, setPending] = useState(false)
  const [announcement, setAnnouncement] = useState('')

  const handleSignOut = async () => {
    setPending(true)
    const stashed = await signOut()
    setPending(false)
    setAnnouncement(
      stashed === 0
        ? t("Vous êtes déconnecté. Vos documents de ce compte sont enregistrés.")
        : t("Vous êtes déconnecté. {0} document{1} des modifications gardées pour votre prochaine connexion.", [stashed, stashed > 1 ? 's ont' : ' a']),
    )
  }

  let content = null
  switch (session.status) {
    case 'signed-in':
      content = (
        <>
          <Avatar person={session.user} size="sm" />
          <span className={compact ? 'relative hidden max-w-36 min-w-0 truncate text-sm text-ink-soft sm:inline-block' : 'relative max-w-36 min-w-0 truncate text-sm text-ink-soft'} title={session.user.email}>
            <span className="font-semibold text-ink">{displayName(session.user)}</span>
            {compact ? (
              <span className="sr-only"> ({session.user.email})</span>
            ) : (
              <span className="ml-1.5 font-mono text-xs text-ink-soft">{session.user.email}</span>
            )}
          </span>
          {!compact && onShowProfile && (
            <Button type="button" size="sm" onClick={onShowProfile}>
              {t("Mon profil")}</Button>
          )}
          {!compact && onShowClasses && (
            <Button type="button" size="sm" onClick={onShowClasses}>
              {t("Mes classes")}</Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={() => void handleSignOut()}
            loading={pending}
            loadingLabel={compact ? undefined : t("Envoi et déconnexion…")}
            title={t("Se déconnecter")}
            aria-label={t("Se déconnecter")}
          >
            {compact ? <Icon name="logout" /> : t("Se déconnecter")}
          </Button>
        </>
      )
      break
    case 'signed-out':
      if (!compact && onShowSignIn && onShowSignUp) {
        content = (
          <>
            <Button type="button" size="sm" onClick={onShowSignIn}>
              {t("Se connecter")}</Button>
            <Button type="button" size="sm" variant="primary" onClick={onShowSignUp}>
              {t("Créer un compte")}</Button>
          </>
        )
      }
      break
    case 'offline':
      content = (
        <>
          <span className="text-sm text-ink-soft">
            <span aria-hidden="true">⚠ </span>
            {t("Serveur de comptes injoignable")}</span>
          <Button type="button" size="sm" onClick={retry}>
            {t("Réessayer")}</Button>
        </>
      )
      break
    case 'restoring':
      content = <span className="text-sm text-ink-soft">{t("Connexion au compte…")}</span>
      break
    case 'unavailable':
      if (!compact) {
        content = (
          <span className="text-sm text-ink-soft" title={t("Adresse du serveur non configurée (VITE_API_URL)")}>
            {t("Comptes indisponibles")}</span>
        )
      }
      break
  }

  return (
    <div data-account-status="true" className="flex min-w-0 items-center gap-2" aria-label={t("Compte")} role="group">
      <DesktopUpdateButton />
      {content}
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  )
}
