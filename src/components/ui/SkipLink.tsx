/** Lien d'évitement : premier arrêt du clavier, mène droit au contenu. */
export function SkipLink({ target = 'contenu' }: { target?: string }) {
  return (
    <a
      href={`#${target}`}
      className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-control focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-on-accent"
    >
      Aller au contenu
    </a>
  )
}
