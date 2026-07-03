import type { ViewId } from './views'

interface HomeViewProps {
  onSelectView: (view: ViewId) => void
}

const steps: { view: ViewId; title: string; text: string }[] = [
  {
    view: 'dictionnaire',
    title: 'Dictionnaire',
    text: 'La liste maîtresse des propriétés : chaque donnée est définie une seule fois, puis placée dans une entité ou une association.',
  },
  {
    view: 'mcd',
    title: 'MCD',
    text: 'Dessinez le modèle conceptuel : entités, associations, cardinalités. La validation signale les problèmes en direct.',
  },
  {
    view: 'mld',
    title: 'MLD',
    text: 'Générez le modèle logique : tables, clés étrangères et tables de jonction, selon les règles de passage Merise.',
  },
  {
    view: 'mpd',
    title: 'MPD',
    text: 'Le schéma physique : types SQL concrets et clés étrangères fléchées entre les tables.',
  },
  {
    view: 'sql',
    title: 'SQL',
    text: 'Le script CREATE TABLE prêt à exécuter dans MySQL, à copier en un clic.',
  },
]

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="rounded border border-line bg-shell px-1 font-mono text-[11px]">{children}</kbd>
  )
}

/** Page d'accueil : ce qu'est Meriz et comment s'en servir, sans défilement. */
export function HomeView({ onSelectView }: HomeViewProps) {
  return (
    <section aria-label="Accueil" className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col justify-center px-8 py-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Bienvenue dans Meriz</h2>
            <p className="mt-1.5 max-w-xl text-sm leading-6 text-zinc-600">
              La modélisation Merise dans le navigateur : dessinez votre MCD, l'outil vérifie
              sa cohérence puis génère le modèle logique, le schéma physique et le SQL.
              L'alternative moderne à AnalyseSI.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onSelectView('mcd')}
            className="rounded-md border border-indigo-700 bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800"
          >
            Commencer un MCD →
          </button>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              La démarche, dans l'ordre du rail
            </h3>
            <ol className="mt-3 flex flex-col gap-2">
              {steps.map((step, index) => (
                <li key={step.view}>
                  <button
                    type="button"
                    onClick={() => onSelectView(step.view)}
                    className="flex w-full items-start gap-3 rounded-lg border border-line bg-surface p-3 text-left shadow-sm hover:border-indigo-300 hover:bg-indigo-50/40"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-700 font-mono text-xs font-semibold text-white"
                    >
                      {index + 1}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{step.title}</span>
                      <span className="mt-0.5 block text-xs leading-5 text-zinc-600">
                        {step.text}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-line bg-surface p-4 shadow-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                L'essentiel du canvas
              </h3>
              <ul className="mt-3 flex flex-col gap-2 text-sm leading-6 text-zinc-700">
                <li>
                  <span className="font-medium text-ink">Relier :</span> tirez un trait depuis
                  le point d'une association vers une entité, la patte porte sa cardinalité.
                </li>
                <li>
                  <span className="font-medium text-ink">Sélection multiple :</span> tracez une
                  zone à la souris, ou <Kbd>Maj</Kbd>+clic pour ajouter un élément.
                </li>
                <li>
                  <span className="font-medium text-ink">Naviguer :</span> molette pour se
                  déplacer, <Kbd>Ctrl</Kbd>+molette pour zoomer, bouton du milieu pour panner.
                </li>
              </ul>
            </div>

            <div className="rounded-lg border border-line bg-surface p-4 shadow-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Bon à savoir
              </h3>
              <ul className="mt-3 flex flex-col gap-2 text-sm leading-6 text-zinc-700">
                <li>
                  <Kbd>Ctrl+Z</Kbd> annule, <Kbd>Ctrl+Y</Kbd> rétablit, <Kbd>Suppr</Kbd> efface
                  la sélection.
                </li>
                <li>
                  Votre travail est <span className="font-medium text-ink">sauvegardé
                  automatiquement</span> dans le navigateur. Enregistrer / Ouvrir pour partager
                  un fichier, Exporter en image pour un PNG du schéma.
                </li>
                <li>Tout est utilisable au clavier, du dessin à la génération.</li>
              </ul>
            </div>

            <p className="px-1 text-xs leading-5 text-zinc-500">
              Un exemple complet est fourni dans le dossier{' '}
              <span className="font-mono">examples/universite.meriz.json</span> du projet :
              ouvrez-le pour explorer toutes les fonctions.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
