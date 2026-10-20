type Guard = () => Promise<boolean>
const guards = new Set<Guard>()

/** L'éditeur actif doit confirmer la sauvegarde avant de quitter le logiciel. */
export function registerUpdateGuard(guard: Guard): () => void {
  guards.add(guard)
  return () => { guards.delete(guard) }
}

export async function prepareDesktopUpdate(): Promise<void> {
  for (const guard of guards) {
    if (!await guard()) throw new Error('La sauvegarde du document n’est pas terminée. Réessayez avant de mettre à jour.')
  }
}
