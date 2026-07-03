import type { ReactNode } from 'react'
import type { ViewId } from './views'

interface LearnViewProps {
  onSelectView: (view: ViewId) => void
}

const SECTIONS: readonly { id: string; title: string }[] = [
  { id: 'pourquoi', title: '1. Pourquoi modéliser' },
  { id: 'merise', title: '2. Merise en bref' },
  { id: 'dictionnaire', title: '3. Le dictionnaire des données' },
  { id: 'briques', title: '4. Les briques du MCD' },
  { id: 'cardinalites', title: '5. Les cardinalités' },
  { id: 'types', title: '6. Les types de données' },
  { id: 'transformation', title: '7. Du MCD au SQL' },
  { id: 'sql', title: '8. Le SQL et les bases' },
  { id: 'pratique', title: '9. Prendre en main Meriz' },
]

/** Mini carte d'entité, dans le style réel du canvas. */
function MiniEntity({ name, rows }: { name: string; rows: [string, string, boolean][] }) {
  return (
    <div className="inline-block min-w-40 rounded-lg border border-zinc-300 bg-surface text-left shadow-sm">
      <div className="rounded-t-lg border-b border-line bg-shell px-3 py-1 text-center text-xs font-semibold">
        {name}
      </div>
      <ul className="px-3 py-1.5 text-[11px] leading-5">
        {rows.map(([attribute, type, isIdentifier]) => (
          <li key={attribute} className="flex items-baseline gap-2">
            <span
              className={
                isIdentifier ? 'font-medium underline decoration-indigo-700 underline-offset-2' : ''
              }
            >
              {attribute}
            </span>
            <span className="font-mono text-[10px] text-zinc-500">{type}</span>
            {isIdentifier && (
              <span className="ml-auto rounded-sm border border-indigo-200 bg-indigo-50 px-1 font-mono text-[9px] font-medium text-indigo-700">
                clé
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Pastille de cardinalité, comme sur les pattes du canvas. */
function CardinalityPill({ value }: { value: string }) {
  return (
    <span className="rounded-sm border border-zinc-300 bg-surface px-1 font-mono text-[11px]">
      {value}
    </span>
  )
}

function MoreInfo({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="mt-2 rounded border border-line bg-shell/60 px-3 py-2 text-sm">
      <summary className="cursor-pointer text-xs font-medium text-zinc-700">{summary}</summary>
      <div className="mt-2 flex flex-col gap-2 text-sm leading-6 text-zinc-700">{children}</div>
    </details>
  )
}

function TryButton({
  onSelectView,
  view = 'mcd',
  label = 'Essaie dans le MCD →',
}: {
  onSelectView: (view: ViewId) => void
  view?: ViewId
  label?: string
}) {
  return (
    <button
      type="button"
      onClick={() => onSelectView(view)}
      className="mt-3 self-start rounded-md border border-indigo-700 bg-indigo-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-800"
    >
      {label}
    </button>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-titre`}
      className="scroll-mt-4 rounded-lg border border-line bg-surface p-5 shadow-sm"
    >
      <h3 id={`${id}-titre`} tabIndex={-1} className="text-lg font-semibold tracking-tight">
        {title}
      </h3>
      <div className="mt-3 flex flex-col gap-2.5 text-sm leading-6 text-zinc-700">{children}</div>
    </section>
  )
}

const GLOSSARY: readonly [string, string][] = [
  ['Entité', 'Objet du domaine dont on garde les données, comme Client ou Commande.'],
  ['Propriété', 'Une information portée, comme un nom ou une date. Définie une fois au dictionnaire.'],
  ['Identifiant', 'La ou les propriétés qui distinguent chaque occurrence, comme un numéro de client.'],
  ['Association', 'Un lien entre entités, comme passer entre Client et Commande.'],
  ['Patte', 'La connexion entre une association et une entité. Elle porte la cardinalité.'],
  ['Cardinalité', 'Le couple (minimum, maximum) qui dit combien de fois une occurrence participe.'],
  ['Dictionnaire des données', 'La liste maîtresse de toutes les propriétés du projet, sans doublon.'],
  ['Association fonctionnelle', 'Association dont une patte est à maximum 1 : elle devient une clé étrangère, pas une table.'],
  ['Table de liaison', 'La table issue d’une association dont toutes les pattes sont à maximum n. Sa clé réunit celles des entités reliées.'],
  ['Table', 'Le rangement physique : des colonnes et des lignes dans la base.'],
  ['Clé primaire', 'La colonne (ou le groupe de colonnes) qui identifie chaque ligne de façon unique.'],
  ['Clé étrangère', 'Une colonne qui référence la clé primaire d’une autre table et matérialise le lien.'],
  ['Jointure', 'L’opération SQL qui recolle deux tables en suivant une clé étrangère (INNER JOIN).'],
  ['DDL et DML', 'Les deux familles SQL : définir la structure (CREATE, ALTER, DROP) et manipuler les données (SELECT, INSERT, UPDATE, DELETE).'],
]

/**
 * Page Apprendre : comprendre Merise et les bases de données, du
 * pourquoi jusqu'au SQL, avec le fil conducteur Client passe Commande.
 * Contenu appuyé sur les cours SGBDR classiques : dictionnaire et ses
 * pièges, règles de passage au MLD, familles d'instructions SQL.
 * Présentation uniquement : rien ici ne touche au modèle.
 */
export function LearnView({ onSelectView }: LearnViewProps) {
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <nav
        aria-label="Sommaire de la page Apprendre"
        className="hidden w-56 shrink-0 overflow-y-auto border-r border-line bg-surface p-4 lg:block"
      >
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Sommaire</h2>
        <ul className="mt-2 flex flex-col gap-1">
          {SECTIONS.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="block rounded px-2 py-1 text-sm text-zinc-700 hover:bg-zinc-200/60"
              >
                {section.title}
              </a>
            </li>
          ))}
          <li>
            <a
              href="#glossaire"
              className="block rounded px-2 py-1 text-sm text-zinc-700 hover:bg-zinc-200/60"
            >
              Glossaire
            </a>
          </li>
        </ul>
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-8 py-8">
          <header>
            <h2 className="text-2xl font-semibold tracking-tight">Apprendre</h2>
            <p className="mt-1.5 text-sm leading-6 text-zinc-600">
              Comprendre ce qu'on fait, pourquoi, et à quoi ça sert. Tout au long de la page,
              le même exemple sert de fil conducteur : un client passe des commandes.
            </p>
          </header>

          <Section id="pourquoi" title="1. Pourquoi modéliser">
            <p>
              Quand met-on en place une base de données ? Quand il y a beaucoup de données à
              traiter, et qu'elles changent souvent : un catalogue de produits, la gestion du
              personnel, les commandes d'une boutique. Un fichier Excel tient un temps, puis
              les problèmes arrivent.
            </p>
            <p>
              Imagine une boutique construite sans réflexion : les noms de clients recopiés
              dans chaque commande. Un client change d'adresse, il faut corriger partout. Deux
              orthographes du même nom, et on ne sait plus qui a commandé quoi. Ce sont des
              erreurs de structure, coûteuses à réparer une fois les données en place.
            </p>
            <p>
              Modéliser avant de coder, c'est séparer le <strong>quoi</strong> (quelles
              données, quels liens) du <strong>comment</strong> (quelle base, quel code). Dans
              un vrai projet, la démarche tient en trois temps : analyser les données avec
              Merise, créer la base sur un serveur (MySQL par exemple), puis construire le
              site ou l'application qui l'exploite. Meriz couvre le premier temps, et prépare
              le deuxième en générant le SQL.
            </p>
          </Section>

          <Section id="merise" title="2. Merise en bref">
            <p>
              Merise est une méthode française d'analyse et de conception. Pour les données,
              elle produit trois documents, du plus abstrait au plus concret :
            </p>
            <ul className="list-inside list-disc">
              <li>
                Le <strong>dictionnaire des données</strong> : le tableau qui répertorie
                toutes les données du projet. C'est la matière première.
              </li>
              <li>
                Le <strong>MCD</strong> (modèle conceptuel) : la représentation graphique des
                données, de leurs regroupements et de leurs relations, sans se soucier de la
                base.
              </li>
              <li>
                Le <strong>MLD</strong> (modèle logique) : la représentation textuelle des
                tables, directement implémentable sur un serveur. Le <strong>MPD</strong>{' '}
                (physique) y ajoute les types précis d'une base donnée, comme MySQL ou
                PostgreSQL.
              </li>
            </ul>
            <p>
              Le rail de Meriz suit exactement cet ordre. Tu ne construis que le dictionnaire
              et le MCD : le reste est calculé.
            </p>
            <MoreInfo summary="En savoir plus : pourquoi la merise ?">
              <p>
                La méthode doit son nom à la merise, la petite cerise sauvage du merisier. Ses
                auteurs voulaient un nom d'arbre : le modèle pousse comme un arbre, du tronc
                conceptuel vers les branches concrètes. Meriz reprend ce nom.
              </p>
            </MoreInfo>
          </Section>

          <Section id="dictionnaire" title="3. Le dictionnaire des données">
            <p>
              Avant de dessiner, on liste. Le dictionnaire répertorie chaque donnée avec son
              nom, sa signification, son type et sa taille :{' '}
              <span className="font-mono text-[13px]">nomClient, texte(50)</span> ou{' '}
              <span className="font-mono text-[13px]">dateCommande, date</span>. Une donnée,
              une ligne, une seule fois.
            </p>
            <p>Quatre pièges classiques à laisser dehors :</p>
            <ul className="list-inside list-disc">
              <li>
                Les <strong>synonymes</strong> : deux noms pour la même donnée (lieuMagasin et
                nomMagasin qui désignent la même chose). On en garde un seul.
              </li>
              <li>
                Les <strong>polysèmes</strong> : un même nom pour deux données différentes.
                « nom » tout court, c'est celui du client ou du magasin ? Écris nomClient et
                nomMagasin.
              </li>
              <li>
                Les <strong>propriétés calculées</strong> : le prix TTC se déduit du prix HT
                et de la TVA. On ne stocke pas ce qui se calcule.
              </li>
              <li>
                Les <strong>paramètres</strong> : le taux de TVA prend une seule valeur à un
                instant donné. Ce n'est pas une donnée à modéliser.
              </li>
            </ul>
            <p>
              Dans Meriz, la vue Dictionnaire est la liste maîtresse : chaque propriété y est
              définie une seule fois, puis placée dans une entité ou une association.
              Impossible de la redéfinir en double.
            </p>
            <MoreInfo summary="Auto-évaluation : qui entre au dictionnaire ?">
              <p>
                Parmi prixTTC, tauxTVA, nomClient et nomMagasin, lesquels entrent au
                dictionnaire ? Réponse : nomClient et nomMagasin seulement. prixTTC est une
                propriété calculée, tauxTVA un paramètre.
              </p>
            </MoreInfo>
            <TryButton
              onSelectView={onSelectView}
              view="dictionnaire"
              label="Ouvre le dictionnaire →"
            />
          </Section>

          <Section id="briques" title="4. Les briques du MCD">
            <p>
              Une <strong>entité</strong> est un objet du domaine, comme Client ou Commande.
              Une <strong>propriété</strong> est une information portée, comme un nom ou une
              date. L'<strong>identifiant</strong> est la ou les propriétés qui distinguent
              chaque occurrence : deux clients peuvent s'appeler Martin, mais chacun a son
              numéro.
            </p>
            <div className="flex flex-wrap items-center gap-4 py-1">
              <MiniEntity
                name="Client"
                rows={[
                  ['numeroClient', 'entier', true],
                  ['nom', 'texte', false],
                ]}
              />
              <span className="flex items-center gap-1 text-xs text-zinc-600">
                <CardinalityPill value="0,n" />
                <span aria-hidden="true" className="inline-block h-px w-5 bg-zinc-400" />
                <span className="rounded-full border border-indigo-300 bg-indigo-50/60 px-3 py-0.5 text-xs font-semibold">
                  passer
                </span>
                <span aria-hidden="true" className="inline-block h-px w-5 bg-zinc-400" />
                <CardinalityPill value="1,1" />
              </span>
              <MiniEntity
                name="Commande"
                rows={[
                  ['numeroCommande', 'entier', true],
                  ['dateCommande', 'date', false],
                ]}
              />
            </div>
            <p>
              Une <strong>association</strong> est un lien entre entités : « passer » relie
              Client et Commande. Chaque <strong>patte</strong> relie l'association à une
              entité et porte une <strong>cardinalité</strong>. Une association peut aussi
              porter ses propres propriétés : une note d'examen appartient au lien entre
              l'étudiant et le cours, pas à l'un des deux seul.
            </p>
            <p>La recette du MCD tient en trois gestes :</p>
            <ol className="list-inside list-decimal">
              <li>regrouper les propriétés dans des entités, derrière un identifiant unique,</li>
              <li>relier les entités par des associations,</li>
              <li>poser les cardinalités sur chaque patte.</li>
            </ol>
            <TryButton onSelectView={onSelectView} />
          </Section>

          <Section id="cardinalites" title="5. Les cardinalités expliquées">
            <p>
              Une cardinalité est un couple minimum et maximum posé sur la patte. Elle se lit
              toujours <strong>depuis l'entité</strong> : une occurrence de cette entité
              participe au minimum et au maximum tant de fois à l'association. Les quatre
              valeurs possibles :
            </p>
            <ul className="flex flex-wrap gap-2 py-1">
              {[
                ['0,1', 'au plus une fois'],
                ['1,1', 'exactement une fois'],
                ['0,n', 'zéro, une ou plusieurs fois'],
                ['1,n', 'au moins une fois'],
              ].map(([value, reading]) => (
                <li key={value} className="flex items-center gap-1.5 text-xs text-zinc-700">
                  <CardinalityPill value={value ?? ''} /> {reading}
                </li>
              ))}
            </ul>
            <p>
              Sur l'exemple : côté Client <CardinalityPill value="0,n" /> se lit « un client
              passe de zéro à plusieurs commandes ». Côté Commande{' '}
              <CardinalityPill value="1,1" /> se lit « une commande est passée par exactement
              un client ». C'est le point le plus souvent inversé par les débutants : on part
              toujours de l'entité, jamais de l'association.
            </p>
            <p>
              D'où viennent ces chiffres ? Des <strong>règles de gestion</strong>, les phrases
              du client du projet. « Un article est livré par un seul fournisseur » donne
              (1,1) côté article. « Un fournisseur peut fournir zéro ou plusieurs articles »
              donne (0,n) côté fournisseur. Le modèle traduit des phrases, pas des intuitions.
            </p>
            <MoreInfo summary="Auto-évaluation : à toi de lire">
              <p>
                Un livre est écrit par un ou plusieurs auteurs, un auteur peut n'avoir rien
                écrit chez nous. Côté Livre : (1,n). Côté Auteur : (0,n). Si tu as trouvé, les
                cardinalités sont acquises.
              </p>
            </MoreInfo>
            <TryButton onSelectView={onSelectView} />
          </Section>

          <Section id="types" title="6. Les types de données">
            <p>Au MCD, chaque propriété porte un des sept types conceptuels :</p>
            <ul className="grid gap-1 font-mono text-[13px] sm:grid-cols-2">
              <li>texte : du texte, comme un nom</li>
              <li>entier : un nombre entier, comme une quantité</li>
              <li>decimal : un nombre à virgule, comme un prix</li>
              <li>booleen : vrai ou faux</li>
              <li>date : une date</li>
              <li>datetime : une date avec l'heure</li>
              <li>heure : une heure seule</li>
            </ul>
            <p>
              Ces types décrivent le sens de la donnée, pas son stockage. La taille (par
              exemple texte(50) pour un nom) précise la longueur prévue. Types et tailles
              deviennent des types SQL concrets (VARCHAR, INT…) seulement au niveau MPD,
              jamais avant : le MCD reste indépendant de la base choisie.
            </p>
          </Section>

          <Section id="transformation" title="7. Du MCD au SQL, le voyage">
            <p>
              Un peu de vocabulaire d'abord. Une association dont une patte est à maximum 1
              s'appelle <strong>fonctionnelle</strong> : connaître une commande suffit à
              connaître son client. Une association dont toutes les pattes sont à maximum n
              est <strong>non fonctionnelle</strong>. Cette distinction commande tout le
              passage au MLD, en trois règles :
            </p>
            <ol className="list-inside list-decimal">
              <li>
                Chaque <strong>entité devient une table</strong>, son identifiant devient la
                clé primaire.
              </li>
              <li>
                Une association <strong>fonctionnelle</strong> ne devient pas une table : on
                injecte la clé de la table du côté n dans la table du côté 1, où elle devient
                une clé étrangère, notée avec un dièse. Commande est à (1,1) : la table
                Commande reçoit <span className="font-mono text-[13px]">#numeroClient</span>.
              </li>
              <li>
                Une association <strong>non fonctionnelle</strong> (ou reliant trois entités
                et plus) devient une <strong>table de liaison</strong> qui porte son nom : on
                y met les clés des entités reliées (qui forment ensemble la clé primaire) et
                les propriétés portées.
              </li>
            </ol>
            <p>En notation relationnelle, l'exemple donne :</p>
            <pre className="overflow-x-auto rounded border border-line bg-shell p-3 font-mono text-[12px] leading-5 text-zinc-700">
              {`Client (numeroClient, nom)
Commande (numeroCommande, dateCommande, #numeroClient)`}
            </pre>
            <MoreInfo summary="En savoir plus : quand une règle de gestion change">
              <p>
                Un classique des cours : des articles vendus chacun dans un seul magasin, avec
                un stock par article. L'association articles-magasins est à (1,1) côté
                article, et le stock est une propriété de l'article. Puis la règle change :
                « un article peut être vendu dans plusieurs magasins ».
              </p>
              <p>
                La cardinalité passe à (1,n), l'association devient non fonctionnelle, et le
                stock quitte l'article : il dépend maintenant du couple article et magasin,
                donc il migre <strong>sur l'association</strong>. Au MLD, tout finit dans la
                table de liaison :{' '}
                <span className="font-mono text-[12px]">
                  disposer (#refArticle, #codeMagasin, stock)
                </span>
                . Retiens la leçon : les cardinalités viennent des règles de gestion, et une
                phrase qui change peut déplacer une propriété.
              </p>
            </MoreInfo>
            <MoreInfo summary="Auto-évaluation : où va la clé ?">
              <p>
                Un étudiant prépare exactement un diplôme (1,1), un diplôme est préparé par
                zéro ou plusieurs étudiants (0,n). La clé étrangère codeDiplome va dans la
                table Etudiant, le côté à maximum 1. Si tu l'aurais mise dans Diplome, relis
                la règle 2.
              </p>
            </MoreInfo>
          </Section>

          <Section id="sql" title="8. Le SQL et les bases de données">
            <p>
              Une base de données stocke les données dans des <strong>tables</strong>, faites
              de colonnes et de lignes. La <strong>clé primaire</strong> identifie chaque
              ligne de façon unique. La <strong>clé étrangère</strong> référence la clé
              primaire d'une autre table et matérialise le lien.
            </p>
            <p>
              Le SQL se range en familles. Le <strong>DDL</strong> (data definition language)
              définit la structure : CREATE, ALTER, DROP. Le <strong>DML</strong> (data
              manipulation language) manipule les données : SELECT, INSERT, UPDATE, DELETE.
              Le script généré par Meriz, c'est la partie DDL :
            </p>
            <pre className="overflow-x-auto rounded border border-line bg-shell p-3 font-mono text-[12px] leading-5 text-zinc-700">
              {`CREATE TABLE Client (
  numeroClient INT NOT NULL AUTO_INCREMENT,
  nom VARCHAR(255) NOT NULL,
  PRIMARY KEY (numeroClient)
);`}
            </pre>
            <p>
              Et la clé étrangère, à quoi sert-elle ensuite ? À la <strong>jointure</strong>,
              l'opération qui recolle les tables. Afficher chaque commande avec le nom de son
              client :
            </p>
            <pre className="overflow-x-auto rounded border border-line bg-shell p-3 font-mono text-[12px] leading-5 text-zinc-700">
              {`SELECT numeroCommande, nom
FROM Commande
INNER JOIN Client ON Commande.numeroClient = Client.numeroClient;`}
            </pre>
            <p>
              Un MCD juste, ce sont des jointures simples plus tard. Une fois le script
              exporté depuis Meriz, importe-le dans ton serveur (phpMyAdmin, onglet SQL ou
              Importer), puis remplis les tables avec des INSERT.
            </p>
            <MoreInfo summary="En savoir plus : petite histoire du SQL">
              <p>
                Le modèle entité-association qui inspire Merise naît au début des années 1970.
                Chez IBM, le langage SEQUEL apparaît vers 1974 et devient SQL. Première
                normalisation en 1986 (SQL-86), puis la version de référence SQL2 en 1992,
                socle de tous les systèmes actuels : MySQL, PostgreSQL, SQLite, SQL Server ou
                Oracle. Le langage que tu apprends a cinquante ans et fait toujours tourner le
                monde.
              </p>
            </MoreInfo>
          </Section>

          <Section id="pratique" title="9. Prendre en main Meriz, pas à pas">
            <ol className="list-inside list-decimal">
              <li>Vue MCD : « Ajouter une entité », nomme-la Client dans le panneau de droite.</li>
              <li>Ajoute ses propriétés, coche « clé » sur numeroClient.</li>
              <li>Crée l'entité Commande, puis « Ajouter une association », nomme-la passer.</li>
              <li>Tire un trait du point de l'association vers chaque entité.</li>
              <li>Clique chaque patte : cardinalité (0,n) côté Client, (1,1) côté Commande.</li>
              <li>Bouton Vérifier (l'engrenage) : corrige ce qu'il signale.</li>
              <li>Bouton Générer (la coche) : le MLD, le MPD et le SQL apparaissent.</li>
              <li>Vue SQL : exporte le script, puis importe-le dans MySQL ou PostgreSQL.</li>
            </ol>
            <TryButton onSelectView={onSelectView} />
          </Section>

          <section
            id="glossaire"
            aria-labelledby="glossaire-titre"
            className="scroll-mt-4 rounded-lg border border-line bg-surface p-5 shadow-sm"
          >
            <h3 id="glossaire-titre" tabIndex={-1} className="text-lg font-semibold tracking-tight">
              Glossaire
            </h3>
            <dl className="mt-3 grid gap-x-6 gap-y-2.5 text-sm leading-6 sm:grid-cols-2 lg:grid-cols-3">
              {GLOSSARY.map(([term, definition]) => (
                <div key={term}>
                  <dt className="font-semibold">{term}</dt>
                  <dd className="text-zinc-600">{definition}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>
    </div>
  )
}
