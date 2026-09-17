import { useEffect, useRef, useState } from 'react'
import type { DocumentMeta } from '../model/document'
import type { DocumentStore } from '../lib/documentStore'
import { AccountStatus } from './AccountStatus'
import { ConfirmDialog } from './ConfirmDialog'
import { DocumentRow } from './DocumentRow'
import { ImportFileButton } from './ImportFileButton'
import { Logo } from './Logo'
import { UiScaleControl } from './UiScaleControl'
import { primaryButtonClass, secondaryButtonClass } from './buttonStyles'

interface DocumentsHomeProps {
  store: DocumentStore
  /** Chaque action d'ouverture renvoie false si le document n'a pas pu être ouvert. */
  onOpenDocument: (id: string) => boolean
  onNewDocument: () => boolean
  onOpenExample: () => boolean
  /** Importe un fichier comme nouveau document : message d'erreur, ou null. */
  onImportFile: (file: File) => Promise<string | null>
  onShowSignIn: () => void
  onShowSignUp: () => void
  /** Message à annoncer à l'arrivée (ex. connexion réussie). */
  announcement: string | null
}

interface StatusMessage {
  kind: 'info' | 'error'
  text: string
}

const STORAGE_ERROR =
  "Le document n'a pas pu être enregistré dans ce navigateur (stockage plein ou indisponible)."

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
 * des documents du navigateur avec leurs actions. Tout est utilisable
 * au clavier et chaque action est annoncée.
 */
export function DocumentsHome({
  store,
  onOpenDocument,
  onNewDocument,
  onOpenExample,
  onImportFile,
  onShowSignIn,
  onShowSignUp,
  announcement,
}: DocumentsHomeProps) {
  const [documents, setDocuments] = useState<DocumentMeta[]>(() => store.listDocuments())
  const [status, setStatus] = useState<StatusMessage | null>(null)
  const [pendingDelete, setPendingDelete] = useState<DocumentMeta | null>(null)
  const listHeadingRef = useRef<HTMLHeadingElement>(null)

  // Posé après le montage : une zone live n'annonce que ce qui change.
  useEffect(() => {
    if (announcement) {
      setStatus({ kind: 'info', text: announcement })
    }
  }, [announcement])

  const refresh = () => setDocuments(store.listDocuments())

  const handleNew = () => {
    if (!onNewDocument()) {
      setStatus({ kind: 'error', text: STORAGE_ERROR })
    }
  }

  const handleExample = () => {
    if (!onOpenExample()) {
      setStatus({ kind: 'error', text: STORAGE_ERROR })
    }
  }

  const handleImport = async (file: File) => {
    const error = await onImportFile(file)
    if (error) {
      setStatus({ kind: 'error', text: `Import de « ${file.name} » impossible : ${error}` })
    }
  }

  const handleOpen = (meta: DocumentMeta) => {
    if (!onOpenDocument(meta.id)) {
      setStatus({
        kind: 'error',
        text: `Le document « ${meta.name} » est illisible et n'a pas pu être ouvert. Il reste conservé dans le navigateur.`,
      })
    }
  }

  const handleRename = (meta: DocumentMeta, name: string) => {
    const renamed = store.renameDocument(meta.id, name)
    refresh()
    setStatus(
      renamed
        ? { kind: 'info', text: `Document « ${meta.name} » renommé en « ${renamed.name} ».` }
        : { kind: 'error', text: `Le document « ${meta.name} » n'a pas pu être renommé.` },
    )
  }

  const handleDuplicate = (meta: DocumentMeta) => {
    const copy = store.duplicateDocument(meta.id)
    refresh()
    setStatus(
      copy
        ? { kind: 'info', text: `Document « ${meta.name} » dupliqué en « ${copy.name} ».` }
        : { kind: 'error', text: `Le document « ${meta.name} » n'a pas pu être dupliqué.` },
    )
  }

  const confirmDelete = () => {
    const meta = pendingDelete
    setPendingDelete(null)
    if (!meta) {
      return
    }
    const deleted = store.deleteDocument(meta.id)
    refresh()
    setStatus(
      deleted
        ? { kind: 'info', text: `Document « ${meta.name} » supprimé.` }
        : { kind: 'error', text: `Le document « ${meta.name} » n'a pas pu être supprimé.` },
    )
    // La ligne supprimée emportait le focus : on le pose sur la liste,
    // une fois la boîte de dialogue refermée.
    window.setTimeout(() => listHeadingRef.current?.focus(), 0)
  }

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
          <AccountStatus onShowSignIn={onShowSignIn} onShowSignUp={onShowSignUp} />
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
            cohérence puis en tire le modèle logique, le schéma physique et le SQL. Chaque
            document est sauvegardé automatiquement dans ce navigateur.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={handleNew} className={primaryButtonClass}>
              Nouveau document
            </button>
            <ImportFileButton className={secondaryButtonClass} onFile={(file) => void handleImport(file)}>
              Ouvrir un fichier
            </ImportFileButton>
            <button type="button" onClick={handleExample} className={secondaryButtonClass}>
              Découvrir avec l'exemple
            </button>
          </div>
        </section>

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

        {!store.isPersistent && (
          <p className="mt-2 rounded border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-zinc-800">
            <span aria-hidden="true">⚠ </span>
            Ce navigateur refuse le stockage local : vos documents seront perdus à la fermeture de
            la page. Pensez à les enregistrer en fichier.
          </p>
        )}

        <div className="mt-6 grid gap-8 lg:grid-cols-3">
          <section aria-labelledby="documents-titre" className="lg:col-span-2">
            <h2
              id="documents-titre"
              ref={listHeadingRef}
              tabIndex={-1}
              className="text-xs font-semibold uppercase tracking-wide text-zinc-600"
            >
              Mes documents
              {documents.length > 0 && ` (${documents.length})`}
            </h2>

            {documents.length === 0 ? (
              <div className="mt-3 rounded-lg border border-dashed border-zinc-300 bg-surface p-8 text-center">
                <p className="text-lg font-semibold tracking-tight">Aucun document pour l'instant</p>
                <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-zinc-600">
                  Créez votre premier modèle, ou partez de l'exemple Client passe Commande pour
                  voir Meriz à l'œuvre en quelques secondes.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <button type="button" onClick={handleNew} className={primaryButtonClass}>
                    Créer mon premier document
                  </button>
                  <button type="button" onClick={handleExample} className={secondaryButtonClass}>
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
                    onOpen={() => handleOpen(meta)}
                    onRename={(name) => handleRename(meta, name)}
                    onDuplicate={() => handleDuplicate(meta)}
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
        message={`Supprimer « ${pendingDelete?.name ?? ''} » ? Cette action est définitive : le document disparaît de ce navigateur.`}
        confirmLabel="Supprimer"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
