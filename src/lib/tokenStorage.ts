/**
 * Jeton de session du serveur, gardé dans le navigateur pour survivre
 * au rechargement. Mode Bearer acté côté serveur (pas de cookie) : le
 * jeton est lisible par le code de la page, d'où l'importance de ne
 * jamais injecter de HTML non maîtrisé dans l'interface.
 */
const TOKEN_KEY = 'meriz-auth-token'

export function readToken(): string | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY)
    return token === null || token.trim() === '' ? null : token
  } catch {
    return null
  }
}

export function saveToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // Stockage refusé : la session vaut pour cette page seulement.
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Rien à faire : sans stockage, aucun jeton n'a pu être gardé.
  }
}
