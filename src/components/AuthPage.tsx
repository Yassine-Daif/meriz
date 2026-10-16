import type { ApiUser } from '../lib/authApi'
import { displayName } from '../lib/authApi'
import { useSession } from './sessionContext'
import { ForgotPasswordForm } from './ForgotPasswordForm'
import { SignInForm } from './SignInForm'
import { SignUpForm } from './SignUpForm'
import { Notice } from './ui/Notice'
import { PublicShell } from './ui/PublicShell'

export type AuthMode = 'sign-in' | 'sign-up' | 'forgot'

interface AuthPageProps {
  mode: AuthMode
  /** Adresse déjà connue, posée dans la connexion. */
  initialEmail?: string
  onModeChange: (mode: AuthMode) => void
  onBack: () => void
  /** Connexion ou inscription réussie : message à annoncer sur l'accueil. */
  onAuthenticated: (message: string) => void
}

const TITLES: Record<AuthMode, { title: string; lede: string }> = {
  'sign-in': {
    title: 'Se connecter',
    lede: 'Retrouvez votre compte Meriz.',
  },
  'sign-up': {
    title: 'Créer un compte',
    lede: 'Un compte gratuit, pour retrouver bientôt vos documents partout. Meriz reste utilisable sans compte.',
  },
  forgot: {
    title: 'Mot de passe oublié',
    lede: 'Indiquez votre adresse : si un compte existe, un lien pour choisir un nouveau mot de passe vous sera envoyé.',
  },
}

/** Écran de connexion ou d'inscription, hors de l'éditeur. */
export function AuthPage({ mode, initialEmail, onModeChange, onBack, onAuthenticated }: AuthPageProps) {
  const { session } = useSession()

  const handleSuccess = (user: ApiUser) => {
    onAuthenticated(
      mode === 'sign-in'
        ? `Connecté en tant que ${displayName(user)}.`
        : `Compte créé. Bienvenue, ${user.firstName ?? displayName(user)} !`,
    )
  }

  let content
  if (session.status === 'unavailable') {
    content = (
      <Notice tone="warning" announce={false}>
        Les comptes ne sont pas disponibles : l'adresse du serveur n'est pas configurée (variable{' '}
        <span className="font-mono">VITE_API_URL</span>). Meriz reste utilisable sans compte, vos documents sont
        gardés dans ce navigateur.
      </Notice>
    )
  } else if (session.status === 'signed-in') {
    content = (
      <p className="text-sm text-ink-soft">
        Vous êtes déjà connecté en tant que <span className="font-semibold text-ink">{displayName(session.user)}</span>.
      </p>
    )
  } else if (mode === 'sign-in') {
    content = (
      <SignInForm
        onSuccess={handleSuccess}
        onSwitchToSignUp={() => onModeChange('sign-up')}
        onForgotPassword={() => onModeChange('forgot')}
        initialEmail={initialEmail}
      />
    )
  } else if (mode === 'forgot') {
    content = <ForgotPasswordForm onSwitchToSignIn={() => onModeChange('sign-in')} />
  } else {
    content = <SignUpForm onSuccess={handleSuccess} onSwitchToSignIn={() => onModeChange('sign-in')} />
  }

  return (
    <PublicShell title={TITLES[mode].title} lede={TITLES[mode].lede} onBack={onBack} focusKey={mode}>
      {content}
    </PublicShell>
  )
}