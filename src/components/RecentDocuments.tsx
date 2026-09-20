import { useEffect, useRef, useState } from 'react'
import type { DocumentMeta } from '../model/document'
import type { ApiError } from '../lib/apiClient'
import type { DocumentRepository } from '../lib/documentRepository'
import { formatDate } from '../lib/formatDate'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'

interface RecentDocumentsProps {
  repository: DocumentRepository
  onOpenDocument: (id: string) => Promise<ApiError | null>
  onNewDocument: () => Promise<ApiError | null>
  /** Vers « Mon travail », la liste complète. */
  onShowAll: () => void
  /** Documents chargés : évite un second appel à qui veut les compter. */
  onLoaded?: (documents: DocumentMeta[]) => void
  limit?: number
}

function mostRecent(documents: DocumentMeta[], limit: number): DocumentMeta[] {
  return [...documents].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit)
}

/**
 * Les derniers documents modifiés, pour reprendre le travail en un
 * clic. La gestion complète (renommer, supprimer…) est dans Mon travail.
 */
export function RecentDocuments({
  repository,
  onOpenDocument,
  onNewDocument,
  onShowAll,
  onLoaded,
  limit = 4,
}: RecentDocumentsProps) {
  const [documents, setDocuments] = useState<DocumentMeta[]>(() => mostRecent(repository.cachedList(), limit))
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Le rappel du parent peut changer à chaque rendu : on garde le dernier
  // sans relancer le chargement.
  const onLoadedRef = useRef(onLoaded)
  useEffect(() => {
    onLoadedRef.current = onLoaded
  }, [onLoaded])

  useEffect(() => {
    let active = true
    void repository.list().then((result) => {
      if (!active) return
      setLoaded(true)
      if (result.ok) {
        setDocuments(mostRecent(result.value.documents, limit))
        onLoadedRef.current?.(result.value.documents)
      }
    })
    return () => {
      active = false
    }
  }, [repository, limit])

  const run = async (action: () => Promise<ApiError | null>) => {
    if (busy) return
    setBusy(true)
    setError(null)
    const failure = await action()
    setBusy(false)
    if (failure) setError(failure.message)
  }

  return (
    <section aria-labelledby="recents-titre">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="recents-titre" className="text-lg font-semibold tracking-tight text-ink">
          Documents récents
        </h2>
        <Button variant="ghost" size="sm" onClick={onShowAll}>
          Tout voir dans Mon travail <span aria-hidden="true">→</span>
        </Button>
      </div>

      <p role="status" aria-live="polite" className="text-sm text-danger empty:hidden">
        {error}
      </p>

      {documents.length === 0 ? (
        <div className="mt-3 rounded-card border border-dashed border-line-strong bg-surface p-6 text-center">
          <p className="text-sm text-ink-soft">
            {loaded ? 'Aucun document pour l’instant.' : 'Chargement de vos documents…'}
          </p>
          {loaded && (
            <Button variant="primary" className="mt-3" onClick={() => void run(onNewDocument)} disabled={busy}>
              Créer mon premier document
            </Button>
          )}
        </div>
      ) : (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {documents.map((meta) => (
            <li key={meta.id}>
              <button
                type="button"
                onClick={() => void run(() => onOpenDocument(meta.id))}
                disabled={busy}
                aria-label={`Ouvrir ${meta.name}, Perso`}
                className="flex w-full items-center gap-3 rounded-card border border-line bg-surface p-4 text-left shadow-soft transition duration-150 hover:shadow-lift disabled:cursor-wait motion-safe:hover:-translate-y-0.5"
              >
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-accent-soft font-mono text-xs font-semibold text-accent-ink"
                >
                  MCD
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{meta.name}</span>
                  <span className="block text-xs text-ink-soft">Modifié le {formatDate(meta.updatedAt)}</span>
                </span>
                <Badge tone="apricot">Perso</Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
