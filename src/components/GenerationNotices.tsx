/** Invite affichée tant que rien n'a été généré depuis le MCD. */
export function EmptyGeneration({ viewName }: { viewName: string }) {
  return (
    <section aria-label={viewName} className="flex flex-1 items-center justify-center p-8">
      <div className="max-w-md rounded-lg border border-line bg-surface p-6 text-center shadow-sm">
        <h2 className="text-lg font-semibold tracking-tight">{viewName}</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Rien à afficher pour l'instant. Ouvrez la vue MCD et utilisez le bouton
          « Générer » (la coche) : il produit le MLD, le MPD et le SQL à partir
          d'un MCD sans erreur. Ensuite, ces vues suivent le MCD automatiquement.
        </p>
      </div>
    </section>
  )
}

/** Bandeau affiché quand le MCD contient des erreurs bloquantes. */
export function ErrorsBanner() {
  return (
    <p className="mb-4 flex items-center gap-1.5 rounded border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-zinc-800">
      <span aria-hidden="true">✕</span>
      Le MCD contient des erreurs : le résultat ci-dessous peut être incomplet.
      Corrigez-les dans la vue MCD (bouton Vérifier).
    </p>
  )
}
