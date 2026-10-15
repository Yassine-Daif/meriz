import { LogoMark } from './ui/Lockup'

/** À propos : le logiciel, son auteur et sa licence. */
export function AboutView() {
  return (
    <section aria-label="À propos" className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-8 py-8">
        <header className="flex items-center gap-3">
          <LogoMark size={44} />
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">À propos de Meriz</h2>
            <p className="mt-0.5 text-sm text-ink-soft">
              Le logiciel, son auteur et sa licence.
            </p>
          </div>
        </header>

        <div className="rounded-card border border-line bg-surface p-5 shadow-soft">
          <h3 className="text-base font-semibold tracking-tight">Le logiciel</h3>
          <p className="mt-2 text-sm leading-6 text-ink-soft">
            Meriz est un outil libre de modélisation de bases de données par la méthode
            Merise, entièrement dans le navigateur. C'est une alternative moderne à
            AnalyseSI : dictionnaire central des propriétés, dessin du MCD, vérification,
            puis génération du MLD, du MPD et du script SQL (MySQL et PostgreSQL). Le nom
            vient de la merise, la petite cerise sauvage qui a donné son nom à la méthode.
          </p>
          <p className="mt-2 text-sm leading-6 text-ink-soft">
            Construit avec React, TypeScript et React Flow. Votre travail reste chez vous :
            tout s'exécute localement, la sauvegarde automatique vit dans votre navigateur
            et les fichiers .meriz.json vous appartiennent.
          </p>
        </div>

        <div className="rounded-card border border-line bg-surface p-5 shadow-soft">
          <h3 className="text-base font-semibold tracking-tight">Auteur</h3>
          <p className="mt-2 text-sm leading-6 text-ink-soft">
            Développé par Yassine Daif. Le code source est ouvert et les contributions sont
            bienvenues :{' '}
            <a
              href="https://github.com/Yassine-Daif/meriz"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-accent-ink underline underline-offset-2 hover:text-ink"
            >
              github.com/Yassine-Daif/meriz
            </a>
            .
          </p>
        </div>

        <div className="rounded-card border border-line bg-surface p-5 shadow-soft">
          <h3 className="text-base font-semibold tracking-tight">Licence</h3>
          <p className="mt-2 text-sm leading-6 text-ink-soft">
            Meriz est un logiciel libre, publié sous licence GNU AGPL 3.0. Vous pouvez
            l'utiliser, l'étudier, le modifier et le partager, y compris dans un cadre
            commercial.
          </p>
          <p className="mt-2 text-sm leading-6 text-ink-soft">
            Une condition vient avec, et elle compte : si vous distribuez une version
            modifiée, ou si vous la rendez accessible par le réseau, elle doit rester
            ouverte sous la même licence et créditer l'auteur.
          </p>
          <p className="mt-2 text-sm leading-6 text-ink-soft">
            Le texte complet est dans le fichier LICENSE du dépôt, et sur{' '}
            <a
              href="https://www.gnu.org/licenses/agpl-3.0.html"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-accent-ink underline underline-offset-2 hover:text-ink"
            >
              gnu.org
            </a>
            . Les dépendances gardent leur propre licence.
          </p>
        </div>
      </div>
    </section>
  )
}
