/**
 * Copie dans le presse-papier. Le navigateur peut refuser, hors
 * connexion sécurisée ou sans autorisation : on rend faux plutôt que de
 * lever, et l'appelant dit la vérité à la personne.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      return false
    }
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
