/**
 * Le retour d'un lien de vérification d'email.
 *
 * Le serveur valide le lien signé puis renvoie la personne vers
 * l'application, avec son verdict dans le paramètre `verification`.
 * Ce module ne fait que lire l'adresse : il n'appelle rien.
 */

export type VerificationResult = 'success' | 'already' | 'expired' | 'invalid'

const RESULTS: VerificationResult[] = ['success', 'already', 'expired', 'invalid']

/** Le chemin par défaut de la page de retour, côté serveur. */
const LANDING_PATH = '/email-verifie'

const PARAM = 'verification'

function isResult(value: string | null): value is VerificationResult {
  return value !== null && (RESULTS as string[]).includes(value)
}

/**
 * Le verdict porté par une adresse, ou null si elle n'en porte aucun.
 *
 * On accepte deux formes, car l'application se construit en chemins
 * relatifs et peut vivre dans un sous-dossier : le chemin de retour,
 * et le seul paramètre, qui suffit quand l'hébergeur ne renvoie pas les
 * chemins inconnus vers l'application.
 *
 * Une valeur inconnue dans le paramètre se traite comme un lien
 * illisible : rien de ce qui arrive par l'URL n'est digne de confiance.
 */
export function readVerification(href: string): VerificationResult | null {
  let url
  try {
    url = new URL(href)
  } catch {
    return null
  }
  const raw = url.searchParams.get(PARAM)
  const landing = url.pathname.replace(/\/$/, '').endsWith(LANDING_PATH)
  if (!landing && raw === null) {
    return null
  }
  if (!landing && !isResult(raw)) {
    return null
  }
  return isResult(raw) ? raw : 'invalid'
}

/**
 * La même adresse sans le verdict, pour que la barre d'adresse et les
 * favoris ne gardent pas un résultat qui ne vaut qu'une fois. Le chemin
 * reste tel quel : c'est à l'hébergeur de le servir.
 */
export function urlWithoutVerification(href: string): string {
  let url
  try {
    url = new URL(href)
  } catch {
    return href
  }
  url.searchParams.delete(PARAM)
  return url.toString()
}
