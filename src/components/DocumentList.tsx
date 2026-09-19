import { useCallback, useEffect, useRef, useState } from 'react'
import type { DocumentMeta } from '../model/document'
import type { ApiError } from '../lib/apiClient'
import type { DocumentRepository } from '../lib/documentRepository'
import { ConfirmDialog } from './ConfirmDialog'
import { DocumentRow } from './DocumentRow'
import { ImportFileButton } from './ImportFileButton'
import { Button } from './ui/Button'
import type { BadgeTone } from './ui/Badge'
import { buttonClass } from './ui/buttonClass'
import { Notice } from './ui/Notice'

interface DocumentListProps {
  /** Espace courant : documents du compte (cloud) ou de cet appareil. */
  repository: DocumentRepository
  cloud: boolean
  /** Titre de la liste (h2). */
  heading: string
  /** Ouvre un document : l'erreur est affichée, sinon l'éditeur s'ouvre. */
  onOpenDocument: (id: string) => Promise<ApiError | null>
  onNewDocument: () => Promise<ApiError | null>
  onOpenExample: () => Promise<ApiError | null>
  /** Importe un fichier comme nouveau document : message d'erreur, ou null. */
  onImportFile: (file: File) => Promise<string | null>
  /** Message à annoncer à l'arrivée (ex. connexion réussie). */
  announcement?: string | null
  /** Pastille de provenance de chaque document (ex. « Perso »). */
  provenance?: { label: string; tone: BadgeTone }
}

interface StatusMessage {
  kind: 'info' | 'error'
  text: string
}

/**
 * Liste des documents d'un espace, avec ses actions : créer, importer,
 * partir de l'exemple, ouvrir, renommer, dupliquer, supprimer. Chaque
 * action est annoncée, et tout marche au clavier.
 */
export function DocumentList({
  repository,
  cloud,
  heading,
  onOpenDocument,
  onNewDocument,
  onOpenExample,
  onImportFile,
  announcement = null,
  provenance,
}: DocumentListProps) {
  const [documents, setDocuments] = useState<DocumentMeta[]>(() => repository.cachedList())
  const [loading, setLoading] = useState(cloud)
  const [offline, setOffline] = useState<ApiError | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pendingCount, setPendingCount] = useState(() => repository.pendingCount())
  const [status, setStatus] = useState<StatusMessage | null>(null)
  const [busy, setBusy] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<DocumentMeta | null>(null)
  const listHeadingRef = useRef<HTMLHeadingElement>(null)

  // Posé après le montage : une zone live n'annonce que ce qui change.
  useEffect(() => {
    if (announcement) {
      setStatus({ kind: 'info', text: announcement })
    }
  }, [announcement])

  const load = useCallback(async () => {
    setLoading(true)
    const result = await repository.list()
    setLoading(false)
    if (result.ok) {
      setDocuments(result.value.documents)
      setOffline(result.value.offline)
      setPendingCount(result.value.pendingCount)
      setLoadError(null)
    } else {
      setDocuments(repository.cachedList())
      setLoadError(result.error.message)
    }
  }, [repository])

  useEffect(() => {
    void load()
  }, [load])

  const refresh = () => {
    setDocuments(repository.cachedList())
    setPendingCount(repository.pendingCount())
  }

  /** Enchaîne une action, en bloquant les doubles clics. */
  const run = async (action: () => Promise<ApiError | null>, success?: string) => {
    if (busy) return
    setBusy(true)
    const error = await action()
    setBusy(false)
    refresh()
    if (error) {
      setStatus({ kind: 'error', text: error.message })
    } else if (success) {
      setStatus({ kind: 'info', text: success })
    }
  }

  const handleImport = async (file: File) => {
    if (busy) return
    setBusy(true)
    const error = await onImportFile(file)
    setBusy(false)
    if (error) {
      setStatus({ kind: 'error', text: `Import de « ${file.name} » impossible : ${error}` })
    }
  }

  const handleRename = (meta: DocumentMeta, name: string) =>
    run(async () => {
      const result = await repository.rename(meta.id, name)
      return result.ok ? null : result.error
    }, `Document « ${meta.name} » renommé.`)

  const handleDuplicate = (meta: DocumentMeta) =>
    run(async () => {
      const result = await repository.duplicate(meta.id)
      return result.ok ? null : result.error
    }, `Document « ${meta.name} » dupliqué.`)

  const confirmDelete = () => {
    const meta = pendingDelete
    setPendingDelete(null)
    if (!meta) return
    void run(async () => {
      const result = await repository.remove(meta.id)
      return result.ok ? null : result.error
    }, `Document « ${meta.name} » supprimé.`).then(() => {
      // La ligne supprimée emportait le focus : on le pose sur la liste.
      window.setTimeout(() => listHeadingRef.current?.focus(), 0)
    })
  }

  return (
    <section aria-labelledby="documents-titre">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={() => void run(onNewDocument)} disabled={busy}>
          <span aria-hidden="true">+</span>
          Nouveau document
        </Button>
        <ImportFileButton className={buttonClass({ variant: 'secondary' })} onFile={(file) => void handleImport(file)}>
          Ouvrir un fichier
        </ImportFileButton>
        <Button variant="ghost" onClick={() => void run(onOpenExample)} disabled={busy}>
          Découvrir avec l'exemple
        </Button>
      </div>

      <p role="status" aria-live="polite" className="mt-3 min-h-6 text-sm">
        {status && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-ink ${
              status.kind === 'error' ? 'bg-warning-soft' : 'bg-sage-soft'
            }`}
          >
            <span aria-hidden="true" className={status.kind === 'error' ? 'text-warning' : 'text-sage'}>
              {status.kind === 'error' ? '⚠' : '✓'}
            </span>
            {status.text}
          </span>
        )}
      </p>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2
          id="documents-titre"
          ref={listHeadingRef}
          tabIndex={-1}
          className="text-lg font-semibold tracking-tight text-ink"
        >
          {heading}
          {documents.length > 0 && <span className="font-normal text-ink-soft"> ({documents.length})</span>}
        </h2>
        {pendingCount > 0 && (
          <span className="text-sm text-ink-soft">
            {pendingCount === 1 ? '1 document en attente d’envoi' : `${pendingCount} documents en attente d’envoi`}
          </span>
        )}
      </div>

      {(offline || loadError) && (
        <Notice
          tone="warning"
          announce={false}
          className="mt-3"
          action={
            <Button size="sm" onClick={() => void load()}>
              Réessayer
            </Button>
          }
        >
          {offline
            ? 'Serveur injoignable : voici les documents gardés sur cet appareil. Votre travail est conservé.'
            : loadError}
        </Notice>
      )}

      {loading && documents.length === 0 ? (
        <p role="status" className="mt-3 rounded-card border border-line bg-surface p-8 text-center text-sm text-ink-soft">
          Chargement de vos documents…
        </p>
      ) : documents.length === 0 ? (
        <div className="mt-3 rounded-card border border-dashed border-line-strong bg-surface p-8 text-center">
          <p className="text-lg font-semibold tracking-tight text-ink">Aucun document pour l'instant</p>
          <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-ink-soft">
            Créez votre premier modèle, ou partez de l'exemple Client passe Commande pour voir Meriz à l'œuvre en
            quelques secondes.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button variant="primary" onClick={() => void run(onNewDocument)} disabled={busy}>
              Créer mon premier document
            </Button>
            <Button onClick={() => void run(onOpenExample)} disabled={busy}>
              Découvrir avec l'exemple
            </Button>
          </div>
        </div>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {documents.map((meta) => (
            <DocumentRow
              key={meta.id}
              meta={meta}
              provenance={provenance}
              onOpen={() => void run(() => onOpenDocument(meta.id))}
              onRename={(name) => void handleRename(meta, name)}
              onDuplicate={() => void handleDuplicate(meta)}
              onRequestDelete={() => setPendingDelete(meta)}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Supprimer le document"
        message={`Supprimer « ${pendingDelete?.name ?? ''} » ? Cette action est définitive${
          cloud ? ' : le document disparaît de votre compte.' : ' : le document disparaît de ce navigateur.'
        }`}
        confirmLabel="Supprimer"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  )
}
