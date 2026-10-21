import { t } from "../i18n/runtime"
import { useLanguage } from "../lib/useLanguage"
import { useCallback, useEffect, useState } from 'react'
import type { AccountSpace } from '../lib/accountController'
import { apiError } from '../lib/apiClient'
import type { DocumentRepository } from '../lib/documentRepository'
import type { DocumentStore, StorageLike } from '../lib/documentStore'
import { markOffered, unofferedLocalIds } from '../lib/importOffers'
import type { DocumentMeta } from '../model/document'
import type { SessionState } from '../lib/sessionState'
import type { ImportReport } from './ImportLocalDialog'

export interface ImportProposal {
  documents: DocumentMeta[]
  phase: 'ask' | 'working' | 'done'
  progress: number
  report: ImportReport | null
}

interface LocalImportOfferOptions {
  account: AccountSpace
  session: SessionState
  localStore: DocumentStore
  /** Même stockage que le cache : la trace des offres vit par compte. */
  storage: { storage: StorageLike }
  repository: DocumentRepository
}

/**
 * L'offre de copier dans le compte les documents de cet appareil.
 *
 * Elle ne se fait qu'une fois par document et par compte : ceux qui ont
 * déjà reçu une réponse ne reviennent pas. Les originaux locaux ne sont
 * jamais touchés, et seuls les documents réellement copiés sont marqués,
 * pour que les autres soient reproposés.
 */
export function useLocalImportOffer({
  account,
  session,
  localStore,
  storage,
  repository,
}: LocalImportOfferOptions) {
  useLanguage()
  const [proposal, setProposal] = useState<ImportProposal | null>(null)

  useEffect(() => {
    if (account.kind !== 'cloud' || session.status !== 'signed-in') {
      setProposal(null)
      return
    }
    const locals = localStore.listDocuments()
    const ids = new Set(unofferedLocalIds(storage.storage, account.userId, locals.map((m) => m.id)))
    const candidates = locals.filter((meta) => ids.has(meta.id))
    setProposal(candidates.length > 0 ? { documents: candidates, phase: 'ask', progress: 0, report: null } : null)
  }, [account, session.status, localStore, storage])

  const runImport = useCallback(async () => {
    if (!proposal || account.kind !== 'cloud') return
    setProposal({ ...proposal, phase: 'working', progress: 0 })
    const importedIds: string[] = []
    const failed: string[] = []
    let done = 0
    for (const meta of proposal.documents) {
      const local = localStore.loadDocument(meta.id)
      const created = local
        ? await repository.create(meta.name, local.state, local.mpdSettings)
        : { ok: false as const, error: apiError('storage', null, t("Document local illisible.")) }
      if (created.ok) {
        importedIds.push(meta.id)
      } else {
        failed.push(meta.name)
      }
      done += 1
      setProposal((current) => (current ? { ...current, progress: done } : current))
    }
    // Seuls les documents réellement copiés sont marqués : les autres
    // seront reproposés, et les originaux locaux restent intacts.
    markOffered(storage.storage, account.userId, importedIds)
    setProposal((current) =>
      current ? { ...current, phase: 'done', report: { imported: importedIds.length, failed } } : current,
    )
  }, [proposal, account, localStore, repository, storage])

  const keepLocal = useCallback(() => {
    if (!proposal || account.kind !== 'cloud') return
    markOffered(storage.storage, account.userId, proposal.documents.map((meta) => meta.id))
    setProposal(null)
  }, [proposal, account, storage])

  return { proposal, runImport, keepLocal, dismiss: () => setProposal(null) }
}
