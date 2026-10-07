/**
 * Qui ensemence un document partagé encore vide.
 *
 * Sur un document de groupe, il n'y a pas de propriétaire : tous les
 * membres sont des pairs. Si deux d'entre eux inscrivaient le contenu du
 * serveur avant de s'être parlé, la fusion garderait les deux
 * insertions, et le modèle apparaîtrait en double.
 *
 * On tranche donc par l'identifiant de client Yjs, unique par onglet :
 * le plus petit ensemence, et tout le monde calcule la même réponse.
 */
export function electsSeeder(mine: number, peers: readonly number[]): boolean {
  return peers.every((peer) => mine < peer)
}
