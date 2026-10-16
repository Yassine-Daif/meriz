/**
 * Le lien de réinitialisation reçu par courrier.
 *
 * Contrairement au lien de vérification d'adresse, qui passe d'abord par
 * l'API, celui-ci mène droit à l'application et porte le jeton et
 * l'adresse. Ce module ne fait que lire l'adresse : il n'appelle rien.
 */

export interface PasswordResetLink {
  token: string
  email: string
}

/** Le chemin par défaut de la page, côté serveur. */
const LANDING_PATH = '/reinitialiser-mot-de-passe'

/**
 * Le jeton et l'adresse portés par une adresse, ou null.
 *
 * On accepte deux formes, comme pour la vérification : le chemin de la
 * page, et les deux paramètres seuls, qui suffisent quand l'application
 * vit dans un sous-dossier et que l'hébergeur ne renvoie pas les chemins
 * inconnus vers elle.
 *
 * Un jeton vide ou une adresse absente ne valent rien : mieux vaut
 * laisser passer que d'ouvrir un formulaire qui échouera.
 */
export function readPasswordReset(href: string): PasswordResetLink | null {
  let url
  try {
    url = new URL(href)
  } catch {
    return null
  }
  const token = url.searchParams.get('token')?.trim() ?? ''
  const email = url.searchParams.get('email')?.trim() ?? ''
  if (token === '' || email === '') {
    return null
  }
  return { token, email }
}

/** Vrai quand l'adresse est celle de la page, quel que soit le dossier. */
export function isPasswordResetPath(href: string): boolean {
  try {
    return new URL(href).pathname.replace(/\/$/, '').endsWith(LANDING_PATH)
  } catch {
    return false
  }
}

/**
 * La même adresse sans le jeton ni l'adresse email. Un jeton de
 * réinitialisation n'a rien à faire dans un historique ni dans un
 * favori : il ne vaut qu'une fois, et il ouvre un compte.
 */
export function urlWithoutPasswordReset(href: string): string {
  let url
  try {
    url = new URL(href)
  } catch {
    return href
  }
  url.searchParams.delete('token')
  url.searchParams.delete('email')
  return url.toString()
}
