import { useEffect, useRef } from 'react'
import type { ApiUser } from '../lib/authApi'
import { displayName } from '../lib/authApi'
import { useSession } from './sessionContext'
import { SignInForm } from './SignInForm'
import { SignUpForm } from './SignUpForm'
import { UiScaleControl } from './UiScaleControl'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { Lockup } from './ui/Lockup'
import { Notice } from './ui/Notice'
import { SkipLink } from './ui/SkipLink'
import { ThemeToggle } from './ui/ThemeToggle'

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
    content = <SignInForm onSuccess={handleSuccess} onSwitchToSignUp={() => onModeChange('sign-up')} />
  } else {
    content = <SignUpForm onSuccess={handleSuccess} onSwitchToSignIn={() => onModeChange('sign-in')} />
  }

  return (
    <div className="h-dvh overflow-y-auto bg-shell font-sans text-ink">
      <SkipLink />

      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface px-4 py-2.5 sm:px-6">
        <Lockup size={30} label="Meriz" />
        <Button variant="ghost" size="sm" onClick={onBack}>
          <span aria-hidden="true">←</span>
          Retour à l'accueil
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <ThemeToggle />
          <UiScaleControl />
        </div>
      </header>

      <main id="contenu" className="mx-auto w-full max-w-md px-4 py-10 sm:py-14">
        <Card className="p-6 sm:p-8">
          <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {TITLES[mode].title}
          </h1>
          <p className="mt-1.5 text-sm leading-6 text-ink-soft">{TITLES[mode].lede}</p>
          <div className="mt-6">{content}</div>
        </Card>
      </main>
    </div>
  )
}