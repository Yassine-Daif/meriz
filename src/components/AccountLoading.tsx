import { useSession } from './sessionContext'
import { Logo } from './Logo'
import { secondaryButtonClass } from './buttonStyles'

interface AccountLoadingProps {
  kind: 'loading' | 'offline-unknown'
}

/**
 * Écran d'attente entre la session et les documents : vérification du
 * compte, ou serveur injoignable sans rien en cache. On n'affiche
 * jamais les documents d'un espace tant que le compte n'est pas connu.
 */
export function AccountLoading({ kind }: AccountLoadingProps) {
  const { retry } = useSession()

  return (
    <div className="flex h-dvh flex-col bg-shell font-sans text-ink">
      <header className="flex items-center gap-2 border-b border-line bg-surface px-4 py-2">
        <Logo />
        <span className="text-base font-semibold tracking-tight">Meriz</span>
      </header>
      <main id="contenu" className="flex flex-1 items-center justify-center px-6">
        <div className="max-w-md rounded-lg border border-line bg-surface p-6 text-center shadow-sm">
          {kind === 'loading' ? (
            <p role="status" className="text-sm text-zinc-700">
              Vérification de votre compte…
            </p>
          ) : (
            <>
              <h1 className="text-lg font-semibold tracking-tight">Serveur injoignable</h1>
              <p role="status" className="mt-2 text-sm leading-6 text-zinc-700">
                Vos documents sont dans votre compte, et ce navigateur n'en garde aucune copie.
                Ils réapparaîtront dès que le serveur répondra.
              </p>
              <button type="button" onClick={retry} className={`${secondaryButtonClass} mt-5`}>
                Réessayer
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
