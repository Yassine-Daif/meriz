import type { StorageLike } from './documentStore'
import { OUTBOX_PREFIX } from './cloudCache'
import { OFFERED_PREFIX } from './importOffers'
import { WORK_PREFIX } from './workDocuments'

/**
 * Effacer ce qu'un compte laisse dans ce navigateur.
 *
 * Une déconnexion ordinaire garde le travail en attente dans la boîte
 * d'envoi du compte, pour sa prochaine visite. Un compte supprimé n'a
 * pas de prochaine visite : sa boîte part aussi, avec ses liens de
 * devoir et la trace des imports déjà proposés.
 *
 * L'espace local d'avant compte, lui, n'appartient à personne en
 * particulier : il ne bouge pas, comme à un changement de compte.
 */
export function eraseAccountTraces(storage: StorageLike, userId: string): void {
  for (const prefix of [OUTBOX_PREFIX, WORK_PREFIX, OFFERED_PREFIX]) {
    try {
      storage.removeItem(prefix + userId)
    } catch {
      // Stockage indisponible : rien à effacer de toute façon.
    }
  }
}
