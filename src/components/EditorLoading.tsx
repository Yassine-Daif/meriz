/**
 * Attente pendant que l'éditeur se télécharge.
 *
 * L'éditeur, avec React Flow et Yjs, ne part plus dans le premier
 * chargement : il arrive à l'ouverture d'un document. Ce temps est court,
 * donc l'écran reste sobre et occupe simplement la place.
 *
 * Le texte porte l'information, pas le disque qui tourne : la règle de
 * mouvement réduit fige les animations, et un disque immobile ne dirait
 * rien à qui la demande.
 */
export function EditorLoading() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-shell font-sans text-ink">
      <span
        aria-hidden="true"
        className="h-5 w-5 animate-spin rounded-full border-2 border-ink-soft border-t-transparent"
      />
      <p role="status" className="text-sm text-ink-soft">
        Ouverture de l'éditeur…
      </p>
    </div>
  )
}
