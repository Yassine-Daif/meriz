import { exampleCode } from '../i18n/builtInExample'
import { Translated } from './ui/Translated'
import { t } from "../i18n/runtime"
import { useLanguage } from "../lib/useLanguage"
import type { ReactNode } from 'react'
import { MoreInfo } from './ui/MoreInfo'
import type { ViewId } from './views'

interface LearnViewProps {
  onSelectView: (view: ViewId) => void
}

const SECTIONS: readonly { id: string; title: string }[] = [
  { id: 'pourquoi', get title() { return t("1. Pourquoi modéliser") } },
  { id: 'merise', get title() { return t("2. Merise en bref") } },
  { id: 'dictionnaire', get title() { return t("3. Le dictionnaire des données") } },
  { id: 'briques', get title() { return t("4. Les briques du MCD") } },
  { id: 'cardinalites', get title() { return t("5. Les cardinalités expliquées") } },
  { id: 'types', get title() { return t("6. Les types de données") } },
  { id: 'transformation', get title() { return t("7. Du MCD au SQL, le voyage") } },
  { id: 'sql', get title() { return t("8. Le SQL et les bases de données") } },
  { id: 'code', get title() { return t("9. Du MCD au code de ton framework") } },
  { id: 'pratique', get title() { return t("10. Prendre en main Meriz, pas à pas") } },
]

/** Mini carte d'entité, dans le style réel du canvas. */
function MiniEntity({ name, rows }: { name: string; rows: [string, string, boolean][] }) {
  useLanguage()
  return (
    <div className="inline-block min-w-40 rounded-card border border-line-strong bg-surface text-left shadow-soft">
      <div className="rounded-t-lg border-b border-line bg-shell px-3 py-1 text-center text-xs font-semibold">
        {t(name)}
      </div>
      <ul className="px-3 py-1.5 text-micro leading-5">
        {rows.map(([attribute, type, isIdentifier]) => (
          <li key={attribute} className="flex items-baseline gap-2">
            <span
              className={
                isIdentifier ? 'font-medium underline decoration-accent-ink underline-offset-2' : ''
              }
            >
              {t(attribute)}
            </span>
            <span className="font-mono text-nano text-ink-soft">{t(type)}</span>
            {isIdentifier && (
              <span className="ml-auto rounded-sm border border-line bg-accent-soft px-1 font-mono text-nano font-medium text-accent-ink">
                {t("clé")}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Pastille de cardinalité, comme sur les pattes du canvas. */
function CardinalityPill({ value }: { value: string }) {
  useLanguage()
  return (
    <span className="rounded-sm border border-line-strong bg-surface px-1 font-mono text-micro">
      {value}
    </span>
  )
}

function TryButton({
  onSelectView,
  view = 'mcd',
  label = t("Essaie dans le MCD →"),
}: {
  onSelectView: (view: ViewId) => void
  view?: ViewId
  label?: string
}) {
  useLanguage()
  return (
    <button
      type="button"
      onClick={() => onSelectView(view)}
      className="mt-3 self-start rounded-control border border-accent bg-accent px-3 py-1.5 text-xs font-medium text-on-accent hover:bg-accent-hover"
    >
      {label}
    </button>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  useLanguage()
  return (
    <section
      id={id}
      aria-labelledby={`${id}-titre`}
      className="scroll-mt-4 rounded-card border border-line bg-surface p-5 shadow-soft"
    >
      <h3 id={`${id}-titre`} tabIndex={-1} className="text-lg font-semibold tracking-tight">
        {title}
      </h3>
      <div className="mt-3 flex flex-col gap-2.5 text-sm leading-6 text-ink-soft">{children}</div>
    </section>
  )
}

function getGlossary() { return [
  [t("Entité"), t("Objet du domaine dont on garde les données, comme Client ou Commande.")],
  [t("Propriété"), t("Une information portée, comme un nom ou une date. Définie une fois au dictionnaire.")],
  [t("Identifiant"), t("La ou les propriétés qui distinguent chaque occurrence, comme un numéro de client.")],
  [t("Association"), t("Un lien entre entités, comme passer entre Client et Commande.")],
  [t("Patte"), t("La connexion entre une association et une entité. Elle porte la cardinalité.")],
  [t("Cardinalité"), t("Le couple (minimum, maximum) qui dit combien de fois une occurrence participe.")],
  [t("Dictionnaire des données"), t("La liste maîtresse de toutes les propriétés du projet, sans doublon.")],
  [t("Association fonctionnelle"), t("Association dont une patte est à maximum 1 : elle devient une clé étrangère, pas une table.")],
  [t("Table de liaison"), t("La table issue d’une association dont toutes les pattes sont à maximum n. Sa clé réunit celles des entités reliées.")],
  ['Table', t("Le rangement physique : des colonnes et des lignes dans la base.")],
  [t("Clé primaire"), t("La colonne (ou le groupe de colonnes) qui identifie chaque ligne de façon unique.")],
  [t("Clé étrangère"), t("Une colonne qui référence la clé primaire d’une autre table et matérialise le lien.")],
  [t("Jointure"), t("L’opération SQL qui recolle deux tables en suivant une clé étrangère (INNER JOIN).")],
  [t("DDL et DML"), t("Les deux familles SQL : définir la structure (CREATE, ALTER, DROP) et manipuler les données (SELECT, INSERT, UPDATE, DELETE).")],
  ['Framework', t("Un cadre de travail tout prêt pour construire une application, comme Laravel ou Symfony en PHP.")],
  ['Migration', t("Un fichier du projet qui crée ou modifie les tables. Une commande le joue, et la base suit.")],
  [t("Modèle, ou entité"), t("La classe qui représente une table dans le code et porte ses liens. On dit modèle chez Laravel, entité chez Symfony.")],
] }

/**
 * Page Apprendre : comprendre Merise et les bases de données, du
 * pourquoi jusqu'au SQL, avec le fil conducteur Client passe Commande.
 * Contenu appuyé sur les cours SGBDR classiques : dictionnaire et ses
 * pièges, règles de passage au MLD, familles d'instructions SQL.
 * Présentation uniquement : rien ici ne touche au modèle.
 */
export function LearnView({ onSelectView }: LearnViewProps) {
  useLanguage()
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <nav
        aria-label={t("Sommaire de la page Apprendre")}
        className="hidden w-56 shrink-0 overflow-y-auto border-r border-line bg-surface p-4 lg:block"
      >
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{t("Sommaire")}</h2>
        <ul className="mt-2 flex flex-col gap-1">
          {SECTIONS.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="block rounded-lg px-2 py-1 text-sm text-ink-soft hover:bg-accent-soft hover:text-ink"
              >
                {section.title}
              </a>
            </li>
          ))}
          <li>
            <a
              href="#glossaire"
              className="block rounded-lg px-2 py-1 text-sm text-ink-soft hover:bg-accent-soft hover:text-ink"
            >
              {t("Glossaire")}</a>
          </li>
        </ul>
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-8 py-8">
          <header>
            <h2 className="text-2xl font-semibold tracking-tight">{t("Apprendre")}</h2>
            <p className="mt-1.5 text-sm leading-6 text-ink-soft">
              {t("Comprendre ce qu'on fait, pourquoi, et à quoi ça sert. Tout au long de la page, le même exemple sert de fil conducteur : un client passe des commandes.")}</p>
          </header>

          <Section id="pourquoi" title={t("1. Pourquoi modéliser")}>
            <p>
              {t("Quand met-on en place une base de données ? Quand il y a beaucoup de données à traiter, et qu'elles changent souvent : un catalogue de produits, la gestion du personnel, les commandes d'une boutique. Un fichier Excel tient un temps, puis les problèmes arrivent.")}</p>
            <p>
              {t("Imagine une boutique construite sans réflexion : les noms de clients recopiés dans chaque commande. Un client change d'adresse, il faut corriger partout. Deux orthographes du même nom, et on ne sait plus qui a commandé quoi. Ce sont des erreurs de structure, coûteuses à réparer une fois les données en place.")}</p>
            <p><Translated source="Modéliser avant de coder, c'est séparer le {0} (quelles données, quels liens) du {1} (quelle base, quel code). Dans un vrai projet, la démarche tient en trois temps : analyser les données avec Merise, créer la base sur un serveur (MySQL par exemple), puis construire le site ou l'application qui l'exploite. Meriz couvre le premier temps, et prépare le deuxième en générant le SQL." values={[<strong key="slot-0">{t("quoi")}</strong>, <strong key="slot-1">{t("comment")}</strong>]} /></p>
          </Section>

          <Section id="merise" title={t("2. Merise en bref")}>
            <p>
              {t("Merise est une méthode française d'analyse et de conception. Pour les données, elle produit trois documents, du plus abstrait au plus concret :")}</p>
            <ul className="list-inside list-disc">
              <li><Translated source="Le {0} : le tableau qui répertorie toutes les données du projet. C'est la matière première." values={[<strong key="slot-0">{t("dictionnaire des données")}</strong>]} /></li>
              <li><Translated source="Le {0} (modèle conceptuel) : la représentation graphique des données, de leurs regroupements et de leurs relations, sans se soucier de la base." values={[<strong key="slot-0">{t("MCD")}</strong>]} /></li>
              <li><Translated source="Le {0} (modèle logique) : la représentation textuelle des tables, directement implémentable sur un serveur. Le {1} (physique) y ajoute les types précis d'une base donnée, comme MySQL ou PostgreSQL." values={[<strong key="slot-0">{t("MLD")}</strong>, <strong key="slot-1">{t("MPD")}</strong>]} /></li>
            </ul>
            <p>
              {t("Le rail de Meriz suit exactement cet ordre. Tu ne construis que le dictionnaire et le MCD : le reste est calculé.")}</p>
            <MoreInfo summary={t("En savoir plus : pourquoi la merise ?")}>
              <p>
                {t("La méthode doit son nom à la merise, la petite cerise sauvage du merisier. Ses auteurs voulaient un nom d'arbre : le modèle pousse comme un arbre, du tronc conceptuel vers les branches concrètes. Meriz reprend ce nom.")}</p>
            </MoreInfo>
          </Section>

          <Section id="dictionnaire" title={t("3. Le dictionnaire des données")}>
            <p><Translated source="Avant de dessiner, on liste. Le dictionnaire répertorie chaque donnée avec son nom, sa signification, son type et sa taille : {0} ou {1}. Une donnée, une ligne, une seule fois." values={[<span key="slot-0" className="font-mono text-code">{t("nomClient, texte(50)")}</span>, <span key="slot-1" className="font-mono text-code">{t("dateCommande, date")}</span>]} /></p>
            <p>{t("Quatre pièges classiques à laisser dehors :")}</p>
            <ul className="list-inside list-disc">
              <li><Translated source="Les {0} : deux noms pour la même donnée (lieuMagasin et nomMagasin qui désignent la même chose). On en garde un seul." values={[<strong key="slot-0">{t("synonymes")}</strong>]} /></li>
              <li><Translated source="Les {0} : un même nom pour deux données différentes. « nom » tout court, c'est celui du client ou du magasin ? Écris nomClient et nomMagasin." values={[<strong key="slot-0">{t("polysèmes")}</strong>]} /></li>
              <li><Translated source="Les {0} : le prix TTC se déduit du prix HT et de la TVA. On ne stocke pas ce qui se calcule." values={[<strong key="slot-0">{t("propriétés calculées")}</strong>]} /></li>
              <li><Translated source="Les {0} : le taux de TVA prend une seule valeur à un instant donné. Ce n'est pas une donnée à modéliser." values={[<strong key="slot-0">{t("paramètres")}</strong>]} /></li>
            </ul>
            <p>
              {t("Dans Meriz, la vue Dictionnaire est la liste maîtresse : chaque propriété y est définie une seule fois, puis placée dans une entité ou une association. Impossible de la redéfinir en double.")}</p>
            <MoreInfo summary={t("Auto-évaluation : qui entre au dictionnaire ?")}>
              <p>
                {t("Parmi prixTTC, tauxTVA, nomClient et nomMagasin, lesquels entrent au dictionnaire ? Réponse : nomClient et nomMagasin seulement. prixTTC est une propriété calculée, tauxTVA un paramètre.")}</p>
            </MoreInfo>
            <TryButton
              onSelectView={onSelectView}
              view="dictionnaire"
              label={t("Ouvre le dictionnaire →")}
            />
          </Section>

          <Section id="briques" title={t("4. Les briques du MCD")}>
            <p><Translated source="Une {0} est un objet du domaine, comme Client ou Commande. Une {1} est une information portée, comme un nom ou une date. L'{2} est la ou les propriétés qui distinguent chaque occurrence : deux clients peuvent s'appeler Martin, mais chacun a son numéro." values={[<strong key="slot-0">{t("entité")}</strong>, <strong key="slot-1">{t("propriété")}</strong>, <strong key="slot-2">{t("identifiant")}</strong>]} /></p>
            <div className="flex flex-wrap items-center gap-4 py-1">
              <MiniEntity
                name="Client"
                rows={[
                  ['numeroClient', 'entier', true],
                  ['nom', 'texte', false],
                ]}
              />
              <span className="flex items-center gap-1 text-xs text-ink-soft">
                <CardinalityPill value="0,n" />
                <span aria-hidden="true" className="inline-block h-px w-5 bg-line-strong" />
                <span className="rounded-full border border-line-strong bg-accent-soft px-3 py-0.5 text-xs font-semibold">
                  {t("passer")}</span>
                <span aria-hidden="true" className="inline-block h-px w-5 bg-line-strong" />
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
            <p><Translated source="Une {0} est un lien entre entités : « passer » relie Client et Commande. Chaque {1} relie l'association à une entité et porte une {2}. Une association peut aussi porter ses propres propriétés : une note d'examen appartient au lien entre l'étudiant et le cours, pas à l'un des deux seul." values={[<strong key="slot-0">{t("association")}</strong>, <strong key="slot-1">{t("patte")}</strong>, <strong key="slot-2">{t("cardinalité")}</strong>]} /></p>
            <p>{t("La recette du MCD tient en trois gestes :")}</p>
            <ol className="list-inside list-decimal">
              <li>{t("regrouper les propriétés dans des entités, derrière un identifiant unique,")}</li>
              <li>{t("relier les entités par des associations,")}</li>
              <li>{t("poser les cardinalités sur chaque patte.")}</li>
            </ol>
            <TryButton onSelectView={onSelectView} />
          </Section>

          <Section id="cardinalites" title={t("5. Les cardinalités expliquées")}>
            <p><Translated source="Une cardinalité est un couple minimum et maximum posé sur la patte. Elle se lit toujours {0} : une occurrence de cette entité participe au minimum et au maximum tant de fois à l'association. Les quatre valeurs possibles :" values={[<strong key="slot-0">{t("depuis l'entité")}</strong>]} /></p>
            <ul className="flex flex-wrap gap-2 py-1">
              {[
                ['0,1', t("au plus une fois")],
                ['1,1', t("exactement une fois")],
                ['0,n', t("zéro, une ou plusieurs fois")],
                ['1,n', t("au moins une fois")],
              ].map(([value, reading]) => (
                <li key={value} className="flex items-center gap-1.5 text-xs text-ink-soft">
                  <CardinalityPill value={value ?? ''} /> {t(reading ?? '')}
                </li>
              ))}
            </ul>
            <p>
              {t("Sur l'exemple : côté Client ")}<CardinalityPill value="0,n" /> {t(" se lit « un client passe de zéro à plusieurs commandes ». Côté Commande")}{' '}
              <CardinalityPill value="1,1" /> {t(" se lit « une commande est passée par exactement un client ». C'est le point le plus souvent inversé par les débutants : on part toujours de l'entité, jamais de l'association.")}</p>
            <p><Translated source="D'où viennent ces chiffres ? Des {0}, les phrases du client du projet. « Un article est livré par un seul fournisseur » donne (1,1) côté article. « Un fournisseur peut fournir zéro ou plusieurs articles » donne (0,n) côté fournisseur. Le modèle traduit des phrases, pas des intuitions." values={[<strong key="slot-0">{t("règles de gestion")}</strong>]} /></p>
            <MoreInfo summary={t("Auto-évaluation : à toi de lire")}>
              <p>
                {t("Un livre est écrit par un ou plusieurs auteurs, un auteur peut n'avoir rien écrit chez nous. Côté Livre : (1,n). Côté Auteur : (0,n). Si tu as trouvé, les cardinalités sont acquises.")}</p>
            </MoreInfo>
            <TryButton onSelectView={onSelectView} />
          </Section>

          <Section id="types" title={t("6. Les types de données")}>
            <p>{t("Au MCD, chaque propriété porte un des sept types conceptuels :")}</p>
            <ul className="grid gap-1 font-mono text-code sm:grid-cols-2">
              <li>{t("texte : du texte, comme un nom")}</li>
              <li>{t("entier : un nombre entier, comme une quantité")}</li>
              <li>{t("decimal : un nombre à virgule, comme un prix")}</li>
              <li>{t("booleen : vrai ou faux")}</li>
              <li>{t("date : une date")}</li>
              <li>{t("datetime : une date avec l'heure")}</li>
              <li>{t("heure : une heure seule")}</li>
            </ul>
            <p>
              {t("Ces types décrivent le sens de la donnée, pas son stockage. La taille (par exemple texte(50) pour un nom) précise la longueur prévue. Types et tailles deviennent des types SQL concrets (VARCHAR, INT…) seulement au niveau MPD, jamais avant : le MCD reste indépendant de la base choisie.")}</p>
          </Section>

          <Section id="transformation" title={t("7. Du MCD au SQL, le voyage")}>
            <p><Translated source="Un peu de vocabulaire d'abord. Une association dont une patte est à maximum 1 s'appelle {0} : connaître une commande suffit à connaître son client. Une association dont toutes les pattes sont à maximum n est {1}. Cette distinction commande tout le passage au MLD, en trois règles :" values={[<strong key="slot-0">{t("fonctionnelle")}</strong>, <strong key="slot-1">{t("non fonctionnelle")}</strong>]} /></p>
            <ol className="list-inside list-decimal">
              <li><Translated source="Chaque {0}, son identifiant devient la clé primaire." values={[<strong key="slot-0">{t("entité devient une table")}</strong>]} /></li>
              <li>
                {t("Une association ")}<strong>{t("fonctionnelle")}</strong> {t(" ne devient pas une table : on injecte la clé de la table du côté n dans la table du côté 1, où elle devient une clé étrangère, notée avec un dièse. Commande est à (1,1) : la table Commande reçoit ")}<span className="font-mono text-code">{t("#numeroClient")}</span>.
              </li>
              <li><Translated source="Une association {0} (ou reliant trois entités et plus) devient une {1} qui porte son nom : on y met les clés des entités reliées (qui forment ensemble la clé primaire) et les propriétés portées." values={[<strong key="slot-0">{t("non fonctionnelle")}</strong>, <strong key="slot-1">{t("table de liaison")}</strong>]} /></li>
            </ol>
            <p>{t("En notation relationnelle, l'exemple donne :")}</p>
            <pre tabIndex={0} className="overflow-x-auto rounded-control border border-line bg-shell p-3 font-mono text-xs leading-5 text-ink-soft">
              {t("Client (numeroClient, nom)\nCommande (numeroCommande, dateCommande, #numeroClient)")}
            </pre>
            <MoreInfo summary={t("En savoir plus : quand une règle de gestion change")}>
              <p>
                {t("Un classique des cours : des articles vendus chacun dans un seul magasin, avec un stock par article. L'association articles-magasins est à (1,1) côté article, et le stock est une propriété de l'article. Puis la règle change : « un article peut être vendu dans plusieurs magasins ».")}</p>
              <p><Translated source="La cardinalité passe à (1,n), l'association devient non fonctionnelle, et le stock quitte l'article : il dépend maintenant du couple article et magasin, donc il migre {0}. Au MLD, tout finit dans la table de liaison : {1}. Retiens la leçon : les cardinalités viennent des règles de gestion, et une phrase qui change peut déplacer une propriété." values={[<strong key="slot-0">{t("sur l'association")}</strong>, <span key="slot-1" className="font-mono text-xs">
                  {t("disposer (#refArticle, #codeMagasin, stock)")}</span>]} /></p>
            </MoreInfo>
            <MoreInfo summary={t("Auto-évaluation : où va la clé ?")}>
              <p>
                {t("Un étudiant prépare exactement un diplôme (1,1), un diplôme est préparé par zéro ou plusieurs étudiants (0,n). La clé étrangère codeDiplome va dans la table Etudiant, le côté à maximum 1. Si tu l'aurais mise dans Diplome, relis la règle 2.")}</p>
            </MoreInfo>
          </Section>

          <Section id="sql" title={t("8. Le SQL et les bases de données")}>
            <p><Translated source="Une base de données stocke les données dans des {0}, faites de colonnes et de lignes. La {1} identifie chaque ligne de façon unique. La {2} référence la clé primaire d'une autre table et matérialise le lien." values={[<strong key="slot-0">{t("tables")}</strong>, <strong key="slot-1">{t("clé primaire")}</strong>, <strong key="slot-2">{t("clé étrangère")}</strong>]} /></p>
            <p><Translated source="Le SQL se range en familles. Le {0} (data definition language) définit la structure : CREATE, ALTER, DROP. Le {1} (data manipulation language) manipule les données : SELECT, INSERT, UPDATE, DELETE. Le script généré par Meriz, c'est la partie DDL :" values={[<strong key="slot-0">{t("DDL")}</strong>, <strong key="slot-1">{t("DML")}</strong>]} /></p>
            <pre tabIndex={0} className="overflow-x-auto rounded-control border border-line bg-shell p-3 font-mono text-xs leading-5 text-ink-soft">
              {exampleCode(`CREATE TABLE Client (
  numeroClient INT NOT NULL AUTO_INCREMENT,
  nom VARCHAR(255) NOT NULL,
  PRIMARY KEY (numeroClient)
);`)}
            </pre>
            <p><Translated source="Et la clé étrangère, à quoi sert-elle ensuite ? À la {0}, l'opération qui recolle les tables. Afficher chaque commande avec le nom de son client :" values={[<strong key="slot-0">{t("jointure")}</strong>]} /></p>
            <pre tabIndex={0} className="overflow-x-auto rounded-control border border-line bg-shell p-3 font-mono text-xs leading-5 text-ink-soft">
              {exampleCode(`SELECT numeroCommande, nom
FROM Commande
INNER JOIN Client ON Commande.numeroClient = Client.numeroClient;`)}
            </pre>
            <p>
              {t("Un MCD juste, ce sont des jointures simples plus tard. Une fois le script exporté depuis Meriz, importe-le dans ton serveur (phpMyAdmin, onglet SQL ou Importer), puis remplis les tables avec des INSERT.")}</p>
            <MoreInfo summary={t("En savoir plus : petite histoire du SQL")}>
              <p>
                {t("Le modèle entité-association qui inspire Merise naît au début des années 1970. Chez IBM, le langage SEQUEL apparaît vers 1974 et devient SQL. Première normalisation en 1986 (SQL-86), puis la version de référence SQL2 en 1992, socle de tous les systèmes actuels : MySQL, PostgreSQL, SQLite, SQL Server ou Oracle. Le langage que tu apprends a cinquante ans et fait toujours tourner le monde.")}</p>
            </MoreInfo>
          </Section>

          <Section id="code" title={t("9. Du MCD au code de ton framework")}>
            <p><Translated source="Dernière sortie de la chaîne, et la plus proche d'un vrai projet. Depuis le même MCD, la vue {0} écrit le code de ta base pour deux outils au choix, {1} ou {2}. Chaque fichier porte le dossier où le poser dans ton projet, et se copie d'un bouton." values={[<strong key="slot-0">{t("Code")}</strong>, <strong key="slot-1">{t("Laravel")}</strong>, <strong key="slot-2">{t("Symfony")}</strong>]} /></p>
            <p><Translated source="Laravel et Symfony sont deux {0} PHP, c'est-à-dire des cadres de travail tout prêts pour construire une application web. On les rencontre partout, en cours comme en entreprise. Ils donnent le squelette du projet et des outils pour les tâches habituelles, dont la base de données." values={[<strong key="slot-0">{t("frameworks")}</strong>]} /></p>
            <p><Translated source="Et c'est là le point important : avec eux, on ne crée pas ses tables à la main dans phpMyAdmin. Tout passe par des {0}, de deux sortes." values={[<strong key="slot-0">{t("fichiers rangés dans le projet")}</strong>]} /></p>
            <ul className="list-inside list-disc">
              <li><Translated source="Une {0} est un fichier qui crée les tables. Une commande le joue, et la base se construit toute seule, à l'identique partout." values={[<strong key="slot-0">{t("migration")}</strong>]} /></li>
              <li><Translated source="Un {0} (chez Laravel) ou une {1} (chez Symfony) est une classe qui représente une table dans le code, et qui porte ses liens : une commande appartient à un client, un client a plusieurs commandes." values={[<strong key="slot-0">{t("modèle")}</strong>, <strong key="slot-1">{t("entité")}</strong>]} /></li>
            </ul>
            <p>
              {t("Sur notre exemple, la cardinalité (1,1) côté Commande devient une méthode de relation chez Laravel :")}</p>
            <pre tabIndex={0} className="overflow-x-auto rounded-control border border-line bg-shell p-3 font-mono text-xs leading-5 text-ink-soft">
              {exampleCode(`class Commande extends Model
{
    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'numero_client', 'numero_client');
    }
}`)}
            </pre>
            <p>{t("Et la même idée, écrite autrement, chez Symfony :")}</p>
            <pre tabIndex={0} className="overflow-x-auto rounded-control border border-line bg-shell p-3 font-mono text-xs leading-5 text-ink-soft">
              {exampleCode(`class Commande
{
    #[ORM\\ManyToOne(targetEntity: Client::class, inversedBy: 'commandes')]
    #[ORM\\JoinColumn(name: 'numero_client', referencedColumnName: 'numero_client')]
    private ?Client $client = null;
}`)}
            </pre>
            <p>
              {t("Deux écritures, une seule origine : la cardinalité que tu as posée sur la patte. C'est la même chaîne que depuis le début, MCD, MLD, MPD, SQL, avec une sortie de plus. Une étape plus avancée, qui relie ce que tu apprends en Merise au code que les développeurs écrivent vraiment.")}</p>
            <p><Translated source="Reste honnête sur ce que tu obtiens : Meriz pose la {0}, pas toute l'application. Les règles de ton projet, les vérifications des informations saisies et les tests restent à écrire. C'est un point de départ solide, à relire et à adapter." values={[<strong key="slot-0">{t("structure des données")}</strong>]} /></p>
            <MoreInfo summary={t("En savoir plus : pourquoi des fichiers plutôt que phpMyAdmin")}>
              <p>
                {t("Parce que la structure voyage alors avec le code. Ton binôme récupère le projet, lance une commande, et obtient exactement les mêmes tables que toi. Sur le serveur, même histoire. Chaque changement laisse une trace, dans un nouveau fichier, et l'on sait qui a ajouté quelle colonne et quand.")}</p>
              <p>
                {t("À la main dans phpMyAdmin, rien de tout cela : la base d'un poste finit par différer de celle du voisin, et personne ne sait plus pourquoi.")}</p>
            </MoreInfo>
            <MoreInfo summary={t("En savoir plus : ce que Meriz décide pour toi")}>
              <p>
                {t("Les noms suivent les habitudes du framework, donc ils peuvent différer du script de la vue SQL : tables au pluriel, colonnes en minuscules avec des tirets bas, classes avec une majuscule à chaque mot.")}</p>
              <p>
                {t("Les relations sont déduites de tes cardinalités : une patte à maximum 1 donne un lien vers un seul objet, une patte à maximum n donne une collection. Et ce que l'outil ne sait pas faire, par exemple suivre un identifiant qui tient sur deux colonnes, est laissé en commentaire plutôt que produit à moitié.")}</p>
            </MoreInfo>
            <TryButton onSelectView={onSelectView} view="code" label={t("Essaie dans la vue Code →")} />
          </Section>

          <Section id="pratique" title={t("10. Prendre en main Meriz, pas à pas")}>
            <ol className="list-inside list-decimal">
              <li>{t("Vue MCD : « Ajouter une entité », nomme-la Client dans le panneau de droite.")}</li>
              <li>{t("Ajoute ses propriétés, coche « clé » sur numeroClient.")}</li>
              <li>{t("Crée l'entité Commande, puis « Ajouter une association », nomme-la passer.")}</li>
              <li>{t("Tire un trait du point de l'association vers chaque entité.")}</li>
              <li>{t("Clique chaque patte : cardinalité (0,n) côté Client, (1,1) côté Commande.")}</li>
              <li>{t("Bouton Vérifier (l'engrenage) : corrige ce qu'il signale.")}</li>
              <li>{t("Bouton Générer (la coche) : le MLD, le MPD et le SQL apparaissent.")}</li>
              <li>{t("Vue SQL : exporte le script, puis importe-le dans MySQL ou PostgreSQL.")}</li>
              <li>
                {t("Vue Code : choisis Laravel ou Symfony, et copie les fichiers dans ton projet.")}</li>
            </ol>
            <TryButton onSelectView={onSelectView} />
          </Section>

          <section
            id="glossaire"
            aria-labelledby="glossaire-titre"
            className="scroll-mt-4 rounded-card border border-line bg-surface p-5 shadow-soft"
          >
            <h3 id="glossaire-titre" tabIndex={-1} className="text-lg font-semibold tracking-tight">
              {t("Glossaire")}</h3>
            <dl className="mt-3 grid gap-x-6 gap-y-2.5 text-sm leading-6 sm:grid-cols-2 lg:grid-cols-3">
              {getGlossary().map(([term, definition]) => (
                <div key={term}>
                  <dt className="font-semibold">{term}</dt>
                  <dd className="text-ink-soft">{definition}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>
    </div>
  )
}
