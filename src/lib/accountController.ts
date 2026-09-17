import type { ApiClient } from './apiClient'
import type { CloudCache } from './cloudCache'
import { createCloudRepository } from './documentRepository'
import type { DocumentRepository } from './documentRepository'

/**
 * Espace de documents affiché selon la session : l'espace local (sans
 * compte), le cloud d'un compte, ou un état d'attente. Chaque espace a
 * une clé : l'interface est remontée entièrement quand elle change.
 */
export type AccountSpace =
  | { kind: 'local'; key: 'local' }
  | { kind: 'loading'; key: 'loading' }
  /** Session gardée mais serveur injoignable, sans cache connu. */
  | { kind: 'offline-unknown'; key: 'offline-unknown' }
  | { kind: 'cloud'; key: string; userId: string; repository: DocumentRepository }

export const LOCAL_SPACE: AccountSpace = { kind: 'local', key: 'local' }
export const LOADING_SPACE: AccountSpace = { kind: 'loading', key: 'loading' }
const OFFLINE_UNKNOWN_SPACE: AccountSpace = { kind: 'offline-unknown', key: 'offline-unknown' }

/** Délai laissé aux envois en attente avant une déconnexion. */
export const SIGN_OUT_FLUSH_MS = 5000

interface AccountControllerOptions {
  cache: CloudCache
  /**
   * Client lié à un jeton. getToken renvoie null dès que le compte est
   * fermé : une requête tardive de l'ancien compte part sans jeton.
   */
  createClient: (getToken: () => string | null, onUnauthorized: () => void) => ApiClient
  /** Le serveur a refusé le jeton du compte ouvert. */
  onExpired: () => void
}

/**
 * Règles de passage d'un compte à l'autre, la barrière anti-mélange :
 * - connexion vérifiée : cache vidé puis rechargé pour ce compte ;
 * - déconnexion, volontaire ou forcée : travail en attente mis de côté
 *   pour son seul propriétaire, puis cache vidé ;
 * - la boîte d'envoi d'un compte n'est reprise qu'après une connexion
 *   vérifiée par le serveur pour ce même compte.
 */
export function createAccountController({ cache, createClient, onExpired }: AccountControllerOptions) {
  let current: { repository: DocumentRepository; deactivate: () => void } | null = null

  const close = () => {
    if (current) {
      current.repository.dispose()
      current.deactivate()
      current = null
    }
  }

  const open = (userId: string, token: string, verified: boolean): AccountSpace => {
    close()
    let active = true
    const client = createClient(
      () => (active ? token : null),
      () => {
        if (active) onExpired()
      },
    )
    const repository = createCloudRepository({ client, cache, userId })
    current = {
      repository,
      deactivate: () => {
        active = false
      },
    }
    if (verified) {
      repository.adoptOutbox(cache.takeOutbox(userId))
    }
    return { kind: 'cloud', key: `user:${userId}`, userId, repository }
  }

  /** Vide le cache après avoir mis de côté le travail en attente. */
  const clearCache = (nextOwner: string | null): number => {
    const stashed = cache.stashPendingToOutbox()
    cache.reset(nextOwner)
    return stashed
  }

  return {
    /** Connexion ou inscription explicite : toujours un cache neuf. */
    signedIn: (userId: string, token: string): AccountSpace => {
      close()
      clearCache(userId)
      return open(userId, token, true)
    },

    /** Session restaurée et confirmée par le serveur (rechargement de page). */
    restored: (userId: string, token: string): AccountSpace => {
      if (cache.owner() !== userId) {
        close()
        clearCache(userId)
      }
      return open(userId, token, true)
    },

    /** Session gardée, serveur injoignable : le cache de son propriétaire, sans boîte d'envoi. */
    restoredOffline: (token: string): AccountSpace => {
      const owner = cache.owner()
      return owner === null ? OFFLINE_UNKNOWN_SPACE : open(owner, token, false)
    },

    /** Déconnexion volontaire. Renvoie le nombre de documents mis de côté. */
    signingOut: async (flushTimeoutMs = SIGN_OUT_FLUSH_MS): Promise<number> => {
      if (current) {
        await current.repository.flushAll(flushTimeoutMs)
      }
      close()
      return clearCache(null)
    },

    /** Jeton refusé par le serveur. Renvoie le nombre de documents mis de côté. */
    expired: (): number => {
      close()
      return clearCache(null)
    },

    /** Démarrage sans session : aucun cache d'un ancien compte ne doit traîner. */
    signedOutAtStartup: (): void => {
      if (cache.owner() !== null || cache.list().length > 0) {
        clearCache(null)
      }
    },

    dispose: close,
  }
}

export type AccountController = ReturnType<typeof createAccountController>
