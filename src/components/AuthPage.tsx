import { useEffect, useRef } from 'react'
import type { ApiUser } from '../lib/authApi'
import { displayName } from '../lib/authApi'
import { useSession } from './sessionContext'
import { SignInForm } from './SignInForm'
import { SignUpForm } from './SignUpForm'
import { Logo } from './Logo'
import { UiScaleControl } from './UiScaleControl'
import { secondaryButtonClass } from './buttonStyles'

export type AuthMode = 'sign-in' | 'sign-up'

interface AuthPageProps {
  mode: AuthMode
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
}

/** Écran de connexion ou d'inscription, hors de l'éditeur. */
export function AuthPage({ mode, onModeChange, onBack, onAuthenticated }: AuthPageProps) {
  const { session } = useSession()
  const headingRef = useRef<HTMLHeadingElement>(null)

  // Nouvel écran : le focus va au titre, pour situer l'utilisateur.
  useEffect(() => {
    headingRef.current?.focus()
  }, [mode])

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
      <p className="rounded-md border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-zinc-800">
        Les comptes ne sont pas disponibles : l'adresse du serveur n'est pas configurée
        (variable <span className="font-mono">VITE_API_URL</span>). Meriz reste utilisable sans
        compte, vos documents sont gardés dans ce navigateur.
      </p>
    )
  } else if (session.status === 'signed-in') {
    content = (
      <p className="text-sm text-zinc-700">
        Vous êtes déjà connecté en tant que{' '}
        <span className="font-semibold text-ink">{displayName(session.user)}</span>.
      </p>
    )
  } else if (mode === 'sign-in') {
    content = (
      <SignInForm onSuccess={handleSuccess} onSwitchToSignUp={() => onModeChange('sign-up')} />
    )
  } else {
    content = (
      <SignUpForm onSuccess={handleSuccess} onSwitchToSignIn={() => onModeChange('sign-in')} />
    )
  }

  return (
    <div className="h-dvh overflow-y-auto bg-shell font-sans text-ink">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10 focus:rounded focus:bg-indigo-700 focus:px-3 focus:py-2 focus:text-white"
      >
        Aller au contenu
      </a>

      <header className="flex items-center gap-2 border-b border-line bg-surface px-4 py-2">
        <Logo />
        <span className="text-base font-semibold tracking-tight">Meriz</span>
        <button type="button" onClick={onBack} className={`${secondaryButtonClass} ml-3 py-1.5`}>
          <span aria-hidden="true">← </span>
          Retour à l'accueil
        </button>
        <div className="ml-auto">
          <UiScaleControl />
        </div>
      </header>

      <main id="contenu" className="mx-auto w-full max-w-md px-6 py-10">
        <div className="rounded-lg border border-line bg-surface p-6 shadow-sm">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl font-semibold tracking-tight"
          >
            {TITLES[mode].title}
          </h1>
          <p className="mt-1 text-sm leading-6 text-zinc-600">{TITLES[mode].lede}</p>
          <div className="mt-5">{content}</div>
        </div>
      </main>
    </div>
  )
}
