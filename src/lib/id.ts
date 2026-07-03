/** Identifiant unique stable pour les éléments du modèle. */
export function newId(): string {
  return crypto.randomUUID()
}
