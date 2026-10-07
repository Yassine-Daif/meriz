import { useCallback, useEffect, useState } from 'react'
import type { ApiClient } from '../../lib/apiClient'
import { deleteCloudDocument, updateCloudDocument } from '../../lib/documentsApi'
import { createGroupDocument, listGroupDocuments } from '../../lib/groupsApi'
import type { GroupDetail, GroupDocument } from '../../lib/groupsApi'
import { serializeModel } from '../../lib/persistence'
import { emptyEditorState } from '../../model/document'
import { DEFAULT_MPD_SETTINGS } from '../../model/mpd'
import { ConfirmDialog } from '../ConfirmDialog'
import { DocumentRow } from '../DocumentRow'
import { Button } from '../ui/Button'
import { Notice } from '../ui/Notice'

export type OpenGroupDocument = (groupId: string, groupName: string, documentId: string) => void

interface GroupDocumentsPanelProps {
  client: ApiClient
  group: GroupDetail
  onOpenGroupDocument: OpenGroupDocument
  onStatus: (text: string) => void
}

/** Un nom neuf qui ne reprend pas celui d'un document déjà là. */
function nextName(documents: GroupDocument[]): string {
  const taken = new Set(documents.map((document) => document.name))
  for (let index = 1; index < 1000; index += 1) {
    const candidate = `Modèle du groupe ${index}`
    if (!taken.has(candidate)) return candidate
  }
  return 'Modèle du groupe'
}

/**
 * Les documents partagés du groupe. Tout membre en crée, les ouvre et
 * les modifie ; plusieurs peuvent y être en même temps, et le travail se
 * synchronise en direct. La suppression, elle, reste à l'auteur du
 * document ou au créateur du groupe : c'est le serveur qui tranche, et
 * son refus s'affiche tel quel.
 */
export function GroupDocumentsPanel({ client, group, onOpenGroupDocument, onStatus }: GroupDocumentsPanelProps) {
  const [documents, setDocuments] = useState<GroupDocument[] | null>(group.documents)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<GroupDocument | null>(null)

  const reload = useCallback(async () => {
    const result = await listGroupDocuments(client, group.id)
    if (result.ok) {
      setDocuments(result.value)
      setError(null)
    } else {
      setError(result.error.message)
    }
  }, [client, group.id])

  useEffect(() => {
    void reload()
  }, [reload])

  const create = async () => {
    setCreating(true)
    const name = nextName(documents ?? [])
    const result = await createGroupDocument(client, group.id, {
      name,
      content: serializeModel(emptyEditorState(), DEFAULT_MPD_SETTINGS, name),
    })
    setCreating(false)
    if (!result.ok) {
      onStatus(result.error.fieldErrors.content?.[0] ?? result.error.message)
      return
    }
    await reload()
    onOpenGroupDocument(group.id, group.name, result.value.id)
  }

  const rename = async (document: GroupDocument, name: string) => {
    const result = await updateCloudDocument(client, document.id, { name })
    if (result.ok) {
      setDocuments((previous) =>
        (previous ?? []).map((item) => (item.id === document.id ? { ...item, name } : item)),
      )
      onStatus(`Document renommé en « ${name} ».`)
    } else {
      onStatus(result.error.message)
    }
  }

  const confirmDelete = async () => {
    const document = pendingDelete
    setPendingDelete(null)
    if (!document) return
    const result = await deleteCloudDocument(client, document.id)
    if (result.ok) {
      setDocuments((previous) => (previous ?? []).filter((item) => item.id !== document.id))
      onStatus(`Document « ${document.name} » supprimé.`)
    } else {
      onStatus(result.error.message)
    }
    await reload()
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-ink">
          Documents partagés
          {documents && documents.length > 0 && (
            <span className="font-normal text-ink-soft"> ({documents.length})</span>
          )}
        </h3>
        <Button variant="primary" size="sm" onClick={() => void create()} loading={creating} loadingLabel="Création…">
          Nouveau document du groupe
        </Button>
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        Ouvrez un document pour travailler dessus. Si plusieurs membres l’ouvrent en même temps, vous vous voyez
        travailler en direct.
      </p>

      {error && (
        <Notice
          tone="warning"
          announce={false}
          className="mt-3"
          action={
            <Button size="sm" onClick={() => void reload()}>
              Réessayer
            </Button>
          }
        >
          {error}
        </Notice>
      )}

      {documents === null ? (
        <p role="status" className="mt-3 text-sm text-ink-soft">
          Chargement des documents du groupe…
        </p>
      ) : documents.length === 0 ? (
        <p className="mt-3 rounded-card border border-dashed border-line-strong bg-surface p-6 text-center text-sm text-ink-soft">
          Aucun document partagé pour l’instant. Créez le premier.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {documents.map((document) => (
            <DocumentRow
              key={document.id}
              meta={document}
              onOpen={() => onOpenGroupDocument(group.id, group.name, document.id)}
              onRename={(name) => void rename(document, name)}
              onRequestDelete={() => setPendingDelete(document)}
              provenance={{ label: 'Groupe', tone: 'sky' }}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Supprimer ce document du groupe ?"
        message={`« ${pendingDelete?.name ?? ''} » disparaîtra pour tous les membres. Seul son auteur ou le créateur du groupe peut le supprimer.`}
        confirmLabel="Oui, supprimer"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
