import { createMemoryStorage } from './documentStore'
import type { StorageLike } from './documentStore'

/**
 * Stockage du navigateur (localStorage) s'il est accessible, sinon un
 * stockage en mémoire : l'application reste utilisable, mais rien ne
 * survit à la fermeture de la page.
 */
export function browserStorage(): { storage: StorageLike; isPersistent: boolean } {
  try {
    const storage = window.localStorage
    const probeKey = 'meriz-storage-probe'
    storage.setItem(probeKey, '1')
    storage.removeItem(probeKey)
    return { storage, isPersistent: true }
  } catch {
    return { storage: createMemoryStorage(), isPersistent: false }
  }
}
