/**
 * Octets en texte, et retour. Les mises à jour Yjs sont binaires, et le
 * canal de diffusion transporte du JSON : il faut donc les encoder pour
 * le voyage, et les décoder à l'arrivée.
 *
 * Quinze lignes de base64 plutôt qu'un sous-module d'une dépendance
 * transitive : c'est aussi sûr, et cela se vérifie.
 */

export function toBase64(bytes: Uint8Array): string {
  let binary = ''
  // Par tranches : une seule application sur un gros tableau ferait
  // déborder la pile des arguments.
  const CHUNK = 8192
  for (let start = 0; start < bytes.length; start += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(start, start + CHUNK))
  }
  return btoa(binary)
}

export function fromBase64(text: string): Uint8Array {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}
