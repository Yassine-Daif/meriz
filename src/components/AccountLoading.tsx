import { useSession } from './sessionContext'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { Lockup } from './ui/Lockup'

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
      <header className="flex items-center border-b border-line bg-surface px-4 py-2.5 sm:px-6">
        <Lockup size={30} label="Meriz" />
      </header>
      <main id="contenu" className="flex flex-1 items-center justify-center px-4">
        <Card className="max-w-md text-center">
          {kind === 'loading' ? (
            <p role="status" className="text-base text-ink-soft">
              Vérification de votre compte…
            </p>
          ) : (
            <>
              <h1 className="text-xl font-semibold tracking-tight text-ink">Serveur injoignable</h1>
              <p role="status" className="mt-2 text-sm leading-6 text-ink-soft">
                Vos documents sont dans votre compte, et ce navigateur n'en garde aucune copie. Ils réapparaîtront
                dès que le serveur répondra.
              </p>
              <Button className="mt-5" onClick={retry}>
                Réessayer
              </Button>
            </>
          )}
        </Card>
      </main>
    </div>
  )
}
