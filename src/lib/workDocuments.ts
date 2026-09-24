import type { StorageLike } from './documentStore'

/**
 * Lien entre un devoir et le document de travail de l'élève.
 *
 * Le serveur ne connaît pas ce lien : pour lui, le travail de l'élève est
 * un document comme un autre, et le rendu n'arrive qu'au clic sur Rendre.
 * Le lien vit donc dans le navigateur, sous une clé qui porte l'identifiant
 * du compte. Aucun mélange n'est possible entre deux comptes : chacun lit
 * sa propre clé, comme la boîte d'envoi (voir cloudCache.ts).
 */

export const WORK_PREFIX = 'meriz-work:'

export interface WorkLinks {
  /** Document de travail lié à ce devoir, ou null. */
  get: (assignmentId: string) => string | null
  /** Lie un document à un devoir. false si le stockage refuse d'écrire. */
  set: (assignmentId: string, documentId: string) => boolean
  /** Oublie le lien (document supprimé, ou reprise à zéro). */
  clear: (assignmentId: string) => boolean
}

function isLinkMap(value: unknown): value is Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  return Object.values(value).every((entry) => typeof entry === 'string')
}

export function createWorkLinks(storage: StorageLike, userId: string): WorkLinks {
  const key = WORK_PREFIX + userId

  const read = (): Record<string, string> => {
    let text: string | null = null
    try {
      text = storage.getItem(key)
    } catch {
      return {}
    }
    if (text === null) {
      return {}
    }
    try {
      const raw: unknown = JSON.parse(text)
      return isLinkMap(raw) ? raw : {}
    } catch {
      return {}
    }
  }

  const write = (links: Record<string, string>): boolean => {
    try {
      if (Object.keys(links).length === 0) {
        storage.removeItem(key)
      } else {
        storage.setItem(key, JSON.stringify(links))
      }
      return true
    } catch {
      return false
    }
  }

  return {
    get: (assignmentId) => read()[assignmentId] ?? null,

    set: (assignmentId, documentId) => write({ ...read(), [assignmentId]: documentId }),

    clear: (assignmentId) => {
      const links = read()
      if (!(assignmentId in links)) {
        return true
      }
      delete links[assignmentId]
      return write(links)
    },
  }
}
