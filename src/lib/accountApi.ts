import type { ApiClient, Outcome } from './apiClient'

/**
 * Emporter ses données, et fermer son compte.
 *
 * Les deux gestes ne portent jamais d'identifiant : le compte visé est
 * celui du jeton, toujours. La suppression demande le mot de passe
 * courant, que le serveur vérifie avant d'effacer quoi que ce soit.
 */

/** Deux chiffres, pour un nom de fichier lisible et trié. */
function pad(value: number): string {
  return value.toString().padStart(2, '0')
}

/**
 * Nom du fichier d'export, daté du jour. Le serveur en propose un dans
 * l'entête de sa réponse, mais une lecture binaire ne rend que le
 * contenu : on le reconstruit donc ici.
 */
export function exportFileName(date: Date): string {
  return `meriz-donnees-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`
}

/** Toutes mes données, en un fichier JSON servi par jeton. */
export function exportAccountData(client: ApiClient): Promise<Outcome<Blob>> {
  return client.requestBlob('/me/export')
}

/**
 * Supprime définitivement son compte. Le mot de passe part en corps,
 * et un mot de passe faux revient en erreur de validation sur ce champ.
 */
export async function deleteAccount(client: ApiClient, password: string): Promise<Outcome<void>> {
  const result = await client.request('DELETE', '/me', { password })
  return result.ok ? { ok: true, value: undefined } : result
}
