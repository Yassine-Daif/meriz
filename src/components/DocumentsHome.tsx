import type { ApiError } from '../lib/apiClient'
import type { DocumentRepository } from '../lib/documentRepository'
import { AccountStatus } from './AccountStatus'
import { DocumentList } from './DocumentList'
import { UiScaleControl } from './UiScaleControl'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { Lockup } from './ui/Lockup'
import { Notice } from './ui/Notice'
import { SkipLink } from './ui/SkipLink'
import { ThemeToggle } from './ui/ThemeToggle'

interface DocumentsHomeProps {
  /** Espace courant : documents de cet appareil, ou cache d'un compte hors ligne. */
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
  /** Message à annoncer à l'arrivée (ex. connexion réussie). */
  announcement: string | null
  /** Avis persistant (session expirée, travail mis de côté). */
  notice: string | null
  onClearNotice: () => void
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
    <kbd className="rounded-md border border-line-strong bg-surface-soft px-1.5 font-mono text-[11px] text-ink">
      {children}
    </kbd>
  )
}

/**
 * Accueil sans compte (ou d'un compte gardé hors ligne) : bienvenue,
 * documents de l'espace courant, prise en main. Tout est utilisable au
 * clavier et chaque action est annoncée.
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
  announcement,
  notice,
  onClearNotice,
}: DocumentsHomeProps) {
  return (
    <div className="h-dvh overflow-y-auto bg-shell font-sans text-ink">
      <SkipLink />

      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface px-4 py-2.5 sm:px-6">
        <Lockup size={30} label="Meriz" />
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <AccountStatus onShowSignIn={onShowSignIn} onShowSignUp={onShowSignUp} />
          <ThemeToggle />
          <UiScaleControl />
        </div>
      </header>

      <main id="contenu" className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 md:px-8">
        <section
          aria-labelledby="bienvenue-titre"
          className="rounded-panel bg-accent-soft px-6 py-7 sm:px-8"
        >
          <h1 id="bienvenue-titre" className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Bienvenue dans Meriz
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-ink">
            La modélisation Merise dans le navigateur : dessinez votre MCD, l'outil vérifie sa cohérence puis en tire
            le modèle logique, le schéma physique et le SQL.{' '}
            {cloud
              ? 'Vos documents sont enregistrés dans votre compte et vous suivent partout.'
              : 'Vos documents sont enregistrés dans ce navigateur.'}
          </p>
        </section>

        {notice && (
          <Notice
            tone="warning"
            className="mt-5"
            action={
              <Button size="sm" onClick={onClearNotice}>
                Compris
              </Button>
            }
          >
            {notice}
          </Notice>
        )}

        {storageWarning && (
          <Notice tone="warning" announce={false} className="mt-5">
            Ce navigateur refuse le stockage local : vos documents seront perdus à la fermeture de la page. Pensez à
            les enregistrer en fichier.
          </Notice>
        )}

        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <DocumentList
              repository={repository}
              cloud={cloud}
              heading={cloud ? 'Documents de votre compte' : 'Documents de cet appareil'}
              onOpenDocument={onOpenDocument}
              onNewDocument={onNewDocument}
              onOpenExample={onOpenExample}
              onImportFile={onImportFile}
              announcement={announcement}
            />
          </div>

          <aside aria-label="Prise en main" className="flex flex-col gap-4">
            <Card>
              <h2 className="text-base font-semibold text-ink">La démarche, dans l'ordre</h2>
              <ol className="mt-3 flex flex-col gap-3">
                {steps.map((step, index) => (
                  <li key={step.title} className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent font-mono text-xs font-semibold text-on-accent"
                    >
                      {index + 1}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-ink">{step.title}</span>
                      <span className="block text-sm leading-6 text-ink-soft">{step.text}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </Card>

            <Card tone="soft">
              <h2 className="text-base font-semibold text-ink">L'essentiel du canvas</h2>
              <ul className="mt-3 flex flex-col gap-2 text-sm leading-6 text-ink-soft">
                <li>
                  <span className="font-medium text-ink">Relier :</span> tirez un trait depuis le point d'une
                  association vers une entité, ou utilisez « Relier à une entité » dans l'inspecteur.
                </li>
                <li>
                  <span className="font-medium text-ink">Sélection multiple :</span> tracez une zone à la souris, ou{' '}
                  <Kbd>Maj</Kbd>+clic.
                </li>
                <li>
                  <Kbd>Ctrl+Z</Kbd> annule, <Kbd>Ctrl+Y</Kbd> rétablit, <Kbd>Suppr</Kbd> efface la sélection.
                </li>
                <li>
                  « Enregistrer » exporte le document en fichier <span className="font-mono">.meriz.json</span>, pour
                  le partager ou l'archiver.
                </li>
              </ul>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  )
}
