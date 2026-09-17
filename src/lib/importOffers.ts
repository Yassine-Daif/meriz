import type { StorageLike } from './documentStore'

/**
 * Suivi, par compte, des documents locaux déjà proposés à l'import.
 * La proposition ne revient que pour des documents locaux nouveaux,
 * jamais pour ceux auxquels ce compte a déjà répondu.
 */
const OFFERED_PREFIX = 'meriz-import-offered:'

function readOffered(storage: StorageLike, userId: string): Set<string> {
  try {
    const text = storage.getItem(OFFERED_PREFIX + userId)
    const raw: unknown = text === null ? [] : JSON.parse(text)
    return new Set(Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : [])
  } catch {
    return new Set()
  }
}

/** Documents locaux que ce compte ne s'est jamais vu proposer. */
export function unofferedLocalIds(storage: StorageLike, userId: string, localIds: string[]): string[] {
  const offered = readOffered(storage, userId)
  return localIds.filter((id) => !offered.has(id))
}

export function markOffered(storage: StorageLike, userId: string, ids: string[]): void {
  const offered = readOffered(storage, userId)
  for (const id of ids) {
    offered.add(id)
  }
  try {
    storage.setItem(OFFERED_PREFIX + userId, JSON.stringify([...offered]))
  } catch {
    // Stockage refusé : la proposition reviendra, rien n'est perdu.
  }
}
