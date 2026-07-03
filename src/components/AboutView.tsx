import { Logo } from './Logo'

const MIT_LICENSE = `MIT License

Copyright (c) 2026 Yassine Daif

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`

/** À propos : le logiciel, son auteur et sa licence. */
export function AboutView() {
  return (
    <section aria-label="À propos" className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-8 py-8">
        <header className="flex items-center gap-3">
          <Logo />
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">À propos de Meriz</h2>
            <p className="mt-0.5 text-sm text-zinc-600">
              Le logiciel, son auteur et sa licence.
            </p>
          </div>
        </header>

        <div className="rounded-lg border border-line bg-surface p-5 shadow-sm">
          <h3 className="text-base font-semibold tracking-tight">Le logiciel</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-700">
            Meriz est un outil libre de modélisation de bases de données par la méthode
            Merise, entièrement dans le navigateur. C'est une alternative moderne à
            AnalyseSI : dictionnaire central des propriétés, dessin du MCD, vérification,
            puis génération du MLD, du MPD et du script SQL (MySQL et PostgreSQL). Le nom
            vient de la merise, la petite cerise sauvage qui a donné son nom à la méthode.
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-700">
            Construit avec React, TypeScript et React Flow. Votre travail reste chez vous :
            tout s'exécute localement, la sauvegarde automatique vit dans votre navigateur
            et les fichiers .meriz.json vous appartiennent.
          </p>
        </div>

        <div className="rounded-lg border border-line bg-surface p-5 shadow-sm">
          <h3 className="text-base font-semibold tracking-tight">Auteur</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-700">
            Développé par Yassine Daif. Le code source est ouvert et les contributions sont
            bienvenues :{' '}
            <a
              href="https://github.com/Yassine-Daif/meriz"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-indigo-700 underline underline-offset-2 hover:text-indigo-800"
            >
              github.com/Yassine-Daif/meriz
            </a>
            .
          </p>
        </div>

        <div className="rounded-lg border border-line bg-surface p-5 shadow-sm">
          <h3 className="text-base font-semibold tracking-tight">Licence</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-700">
            Meriz est distribué sous licence MIT : vous pouvez l'utiliser, le copier, le
            modifier et le redistribuer librement, y compris dans un cadre commercial, à
            condition de conserver la notice ci-dessous.
          </p>
          <pre className="mt-3 overflow-x-auto rounded border border-line bg-shell p-3 font-mono text-[11px] leading-5 text-zinc-700">
            {MIT_LICENSE}
          </pre>
        </div>
      </div>
    </section>
  )
}
