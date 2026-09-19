import { useCallback, useEffect, useRef, useState } from 'react'
import type { DocumentMeta } from '../model/document'
import type { ApiError } from '../lib/apiClient'
import type { DocumentRepository } from '../lib/documentRepository'
import { AccountStatus } from './AccountStatus'
import { ConfirmDialog } from './ConfirmDialog'
import { DocumentRow } from './DocumentRow'
import { ImportFileButton } from './ImportFileButton'
import { Logo } from './Logo'
import { UiScaleControl } from './UiScaleControl'
import { primaryButtonClass, secondaryButtonClass } from './buttonStyles'

interface DocumentsHomeProps {
  /** Espace courant : documents du compte (cloud) ou de cet appareil. */
  repository: DocumentRepository
  cloud: boolean
  /** Le navigateur refuse le stockage : rien ne survivra à la fermeture. */
  storageWarning: boolean
  /** Ouvre un document : l'erreur est affichée, sinon l'éditeur s'ouvre. */
  onOpenDocument: (id: string) => Promise<ApiError | null>
  onNewDocument: () => Promise<ApiError | null>
  onOpenExample: () => Promise<ApiError | null>
  /** Importe un fichier comme nouveau document : message d'erreur, ou null. */
  onImportFile: (file: File) => Promise<string | null>
  onShowSignIn: () => void
  onShowSignUp: () => void
  onShowProfile: () => void
  onShowClasses: () => void
  /** Message à annoncer à l'arrivée (ex. connexion réussie). */
  announcement: string | null
  /** Avis persistant (session expirée, travail mis de côté). */
  notice: string | null
  onClearNotice: () => void
}

interface StatusMessage {
  kind: 'info' | 'error'
  text: string
}

const steps: { title: string; text: string }[] = [
  {
    title: 'Dictionnaire',
    text: 'La liste maîtresse des propriétés : chaque donnée est définie une seule fois, puis placée dans une entité ou une association.',
  },
  {
    title: 'MCD',
    text: 'Dessinez le modèle conceptuel : entités, associations, cardinalités. La validation signale les problèmes en direct.',
  },
  {
    title: 'MLD',
    text: 'Le modèle logique suit le MCD : tables, clés étrangères et tables de jonction, selon les règles de passage Merise.',
  },
  {
    title: 'MPD',
    text: 'Le schéma physique : types SQL concrets et clés étrangères fléchées entre les tables.',
  },
  {
    title: 'SQL',
    text: 'Le script CREATE TABLE prêt à exécuter dans MySQL ou PostgreSQL, à copier en un clic.',
  },
]

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="rounded border border-line bg-shell px-1 font-mono text-[11px]">{children}</kbd>
  )
}

/**
 * Accueil de Meriz : bienvenue, création et import de documents, liste
 * de l'espace courant (compte connecté, ou cet appareil). Tout est
 * utilisable au clavier et chaque action est annoncée.
 */
export function DocumentsHome({
  repository,
  cloud,
  storageWarning,
  onOpenDocument,
  onNewDocument,
  onOpenExample,
  onImportFile,
  onShowSignIn,
  onShowSignUp,
  onShowProfile,
  onShowClasses,
  announcement,
  notice,
  onClearNotice,
}: DocumentsHomeProps) {
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

  const spaceLabel = cloud ? 'Documents de votre compte' : 'Documents de cet appareil'

  return (
    <div className="h-dvh overflow-y-auto bg-shell font-sans text-ink">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10 focus:rounded focus:bg-indigo-700 focus:px-3 focus:py-2 focus:text-white"
      >
        Aller au contenu
      </a>

      <header className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-line bg-surface px-4 py-2">
        <Logo />
        <span className="text-base font-semibold tracking-tight">Meriz</span>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <AccountStatus
            onShowSignIn={onShowSignIn}
            onShowSignUp={onShowSignUp}
            onShowProfile={onShowProfile}
            onShowClasses={onShowClasses}
          />
          <UiScaleControl />
        </div>
      </header>

      <main id="contenu" className="mx-auto w-full max-w-6xl px-6 py-8 md:px-8">
        <section aria-labelledby="bienvenue-titre">
          <h1 id="bienvenue-titre" className="text-3xl font-semibold tracking-tight">
            Bienvenue dans Meriz
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-zinc-600">
            La modélisation Merise dans le navigateur : dessinez votre MCD, l'outil vérifie sa
            cohérence puis en tire le modèle logique, le schéma physique et le SQL.{' '}
            {cloud
              ? 'Vos documents sont enregistrés dans votre compte et vous suivent partout.'
              : 'Vos documents sont enregistrés dans ce navigateur.'}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void run(onNewDocument)}
              disabled={busy}
              className={`${primaryButtonClass} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              Nouveau document
            </button>
            <ImportFileButton className={secondaryButtonClass} onFile={(file) => void handleImport(file)}>
              Ouvrir un fichier
            </ImportFileButton>
            <button
              type="button"
              onClick={() => void run(onOpenExample)}
              disabled={busy}
              className={`${secondaryButtonClass} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              Découvrir avec l'exemple
            </button>
          </div>
        </section>

        {notice && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-zinc-800">
            <p role="status" className="min-w-0 flex-1">
              <span aria-hidden="true">⚠ </span>
              {notice}
            </p>
            <button
              type="button"
              onClick={onClearNotice}
              className="rounded border border-zinc-300 bg-surface px-2 py-1 text-xs text-ink hover:bg-zinc-100"
            >
              Compris
            </button>
          </div>
        )}

        <p role="status" aria-live="polite" className="mt-4 min-h-6 text-sm">
          {status && (
            <span
              className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-zinc-800 ${
                status.kind === 'error' ? 'border-amber-400 bg-amber-50' : 'border-zinc-300 bg-surface'
              }`}
            >
              <span aria-hidden="true">{status.kind === 'error' ? '⚠' : '✓'}</span>
              {status.text}
            </span>
          )}
        </p>

        {storageWarning && (
          <p className="mt-2 rounded border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-zinc-800">
            <span aria-hidden="true">⚠ </span>
            Ce navigateur refuse le stockage local : vos documents seront perdus à la fermeture de
            la page. Pensez à les enregistrer en fichier.
          </p>
        )}

        <div className="mt-6 grid gap-8 lg:grid-cols-3">
          <section aria-labelledby="documents-titre" className="lg:col-span-2">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2
                id="documents-titre"
                ref={listHeadingRef}
                tabIndex={-1}
                className="text-xs font-semibold uppercase tracking-wide text-zinc-600"
              >
                {spaceLabel}
                {documents.length > 0 && ` (${documents.length})`}
              </h2>
              {pendingCount > 0 && (
                <span className="text-xs text-zinc-600">
                  {pendingCount === 1
                    ? '1 document en attente d’envoi'
                    : `${pendingCount} documents en attente d’envoi`}
                </span>
              )}
            </div>

            {(offline || loadError) && (
              <p className="mt-2 flex flex-wrap items-center gap-2 rounded border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-zinc-800">
                <span aria-hidden="true">⚠</span>
                {offline
                  ? 'Serveur injoignable : voici les documents gardés sur cet appareil. Votre travail est conservé.'
                  : loadError}
                <button
                  type="button"
                  onClick={() => void load()}
                  className="rounded border border-zinc-300 bg-surface px-2 py-1 text-xs text-ink hover:bg-zinc-100"
                >
                  Réessayer
                </button>
              </p>
            )}

            {loading && documents.length === 0 ? (
              <p role="status" className="mt-3 rounded-lg border border-line bg-surface p-8 text-center text-sm text-zinc-600">
                Chargement de vos documents…
              </p>
            ) : documents.length === 0 ? (
              <div className="mt-3 rounded-lg border border-dashed border-zinc-300 bg-surface p-8 text-center">
                <p className="text-lg font-semibold tracking-tight">Aucun document pour l'instant</p>
                <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-zinc-600">
                  Créez votre premier modèle, ou partez de l'exemple Client passe Commande pour
                  voir Meriz à l'œuvre en quelques secondes.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => void run(onNewDocument)}
                    disabled={busy}
                    className={`${primaryButtonClass} disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    Créer mon premier document
                  </button>
                  <button
                    type="button"
                    onClick={() => void run(onOpenExample)}
                    disabled={busy}
                    className={`${secondaryButtonClass} disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    Découvrir avec l'exemple
                  </button>
                </div>
              </div>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {documents.map((meta) => (
                  <DocumentRow
                    key={meta.id}
                    meta={meta}
                    onOpen={() => void run(() => onOpenDocument(meta.id))}
                    onRename={(name) => void handleRename(meta, name)}
                    onDuplicate={() => void handleDuplicate(meta)}
                    onRequestDelete={() => setPendingDelete(meta)}
                  />
                ))}
              </ul>
            )}
          </section>

          <aside aria-label="Prise en main" className="flex flex-col gap-4">
            <div className="rounded-lg border border-line bg-surface p-4 shadow-sm">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                La démarche, dans l'ordre
              </h2>
              <ol className="mt-3 flex flex-col gap-2.5">
                {steps.map((step, index) => (
                  <li key={step.title} className="flex items-start gap-2.5">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-700 font-mono text-[11px] font-semibold text-white"
                    >
                      {index + 1}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{step.title}</span>
                      <span className="block text-xs leading-5 text-zinc-600">{step.text}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-lg border border-line bg-surface p-4 shadow-sm">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                L'essentiel du canvas
              </h2>
              <ul className="mt-3 flex flex-col gap-2 text-sm leading-6 text-zinc-700">
                <li>
                  <span className="font-medium text-ink">Relier :</span> tirez un trait depuis le
                  point d'une association vers une entité, ou utilisez « Relier à une entité »
                  dans l'inspecteur.
                </li>
                <li>
                  <span className="font-medium text-ink">Sélection multiple :</span> tracez une
                  zone à la souris, ou <Kbd>Maj</Kbd>+clic.
                </li>
                <li>
                  <Kbd>Ctrl+Z</Kbd> annule, <Kbd>Ctrl+Y</Kbd> rétablit, <Kbd>Suppr</Kbd> efface la
                  sélection.
                </li>
                <li>
                  « Enregistrer » exporte le document en fichier <span className="font-mono">.meriz.json</span>,
                  pour le partager ou l'archiver.
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </main>

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
    </div>
  )
}
