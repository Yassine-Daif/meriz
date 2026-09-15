# État du projet Meriz

Audit en lecture seule du code réel, effectué le 9 septembre 2026.
Dernier commit analysé : `c72ea2b`.

Ce rapport décrit ce qui existe dans le dépôt, pas ce qui était prévu.
Quand le code s'écarte de CLAUDE.md ou du plan, l'écart est signalé.

---

## 1. Vue d'ensemble

Meriz est une application web complète de modélisation Merise, déjà
fonctionnelle du début à la fin de la chaîne. On dessine un MCD dans un
canvas, l'outil valide le modèle, puis génère le MLD, le MPD et un script
SQL exécutable en MySQL ou PostgreSQL.

L'application existe sous trois formes :

- version web, déployée sur `https://meriz.mmi25b06.mmi-troyes.fr/app/`
- logiciel de bureau Windows, macOS et Linux via Tauri, release `v0.1.0` publiée
- site vitrine statique à la racine du même domaine, avec une page de téléchargement

Le projet n'est plus un prototype. Les treize étapes prévues sont livrées.
Ce qui manque relève de la finition et de l'exploitation : aucun test
automatisé, un README vide, et le déploiement web automatique en échec.

---

## 2. État par domaine

| Domaine | Statut | En une ligne |
|---|---|---|
| Modèle de données | Fait | `src/model/mcd.ts`, structure pure, sérialisable, aucune coordonnée de dessin. |
| Dictionnaire central | Fait | Propriétés définies une fois, placées au plus une fois, règle vérifiée par la validation. |
| Canvas MCD | Fait | React Flow contrôlé, glisser fluide, sélection multiple, suppression protégée. |
| Édition et inspecteur | Fait | Formulaires entité, association et patte, avec réserve sur le champ Taille (voir plus bas). |
| Validation | Fait | Deux niveaux, dix-sept invariants documentés, problèmes cliquables. |
| Vue MLD | Fait | Cartes de tables plus notation relationnelle MLDR datée, copiable. |
| Vue MPD | Fait | Diagramme de tables typées et mappage de types éditable, avec réserve sur les positions. |
| Vue SQL | Fait | Script complet, coloration, copie, export `.sql`, DROP optionnels. |
| Page Apprendre | Fait | Neuf sections plus un glossaire, sommaire ancré, environ 500 lignes. |
| Sauvegarde et export | Fait | Format v2 avec migration v1, sélecteur de fichier natif, PNG, autosauvegarde. |
| Coquille et navigation | Fait | Rail de vues, barre supérieure, réglage de taille d'interface. |
| Version PC (Tauri) | Fait | Configuration complète, icônes, workflow de release, `v0.1.0` publiée avec neuf fichiers. |
| Version web (déploiement) | Partiel | Le site tourne, mais le déploiement automatique échoue à chaque push. |
| Tests automatisés | Absent | Aucun test, aucun lanceur de test dans les dépendances. |
| README | Page d'attente | Contient une seule ligne : `# meriz`. |

### Détail par domaine

**Modèle de données.** `Mcd` porte trois listes : `properties`, `entities`,
`associations`. Les positions vivent à part dans `McdLayout`, un simple
`Record<string, Position>`. La séparation modèle / affichage exigée par
CLAUDE.md est réellement respectée : aucun fichier de `src/model` n'importe
React Flow. Les sept types conceptuels sont un tuple `as const` dont le type
dérive, donc la liste d'exécution et le type restent synchronisés. Aucun type
SQL ne remonte au niveau conceptuel.

**Dictionnaire central.** La règle d'unicité Merise est appliquée à deux
endroits : le reducer refuse silencieusement un `PLACE_PROPERTY` sur une
propriété déjà placée, et `validate` signale en erreur tout placement
multiple. `DictionaryView` liste nom, type, taille, utilisation et
placement, avec tri par colonne et suppression protégée par confirmation
quand la propriété est utilisée.

**Canvas MCD.** Le problème de clignotement est résolu proprement :
`McdCanvas` tient un état local de vue, React Flow met à jour ce state
image par image pendant le glisser, et la position n'entre dans le layout
qu'au `onNodeDragStop`, en une seule action `MOVE_NODES` (donc une seule
étape d'annulation, même en glisser groupé). Les entités n'exposent que des
handles `target` et les associations des handles `source`, ce qui empêche
par construction de créer une patte dans le mauvais sens. Le côté d'accroche
est choisi selon l'axe dominant entre les deux nœuds.

**Édition et inspecteur.** L'inspecteur n'édite que lorsqu'un seul élément
est sélectionné, et affiche un message clair sinon. Les formulaires couvrent
le nom, les attributs, l'identifiant (jamais proposé côté association,
conformément à l'invariant 14), la cardinalité par boutons radio limités aux
quatre valeurs valides, et le rôle de patte.

**Validation.** `validate.ts` produit erreurs et avertissements en français.
Les erreurs couvrent les invariants 1 à 16. Les avertissements ajoutent
l'entité isolée, les mots réservés SQL (une liste d'environ 65 mots), la
convention du un à un, l'information sur les ternaires, et la collision de
colonne après migration de clé. Chaque problème porte un `elementId` qui le
rend cliquable vers l'élément fautif.

**MLD, MPD et SQL.** Les trois règles de passage sont implémentées et
commentées dans `mld.ts`. La direction des clés étrangères suit bien la
lecture depuis l'entité. Les associations réflexives préfixent les colonnes
par le rôle. Le MPD ajoute la couche de types SQL, seule couche éditable, et
mémorise dialecte et surcharges. `mpdToSql` trie les tables
topologiquement, sort les clés étrangères en `ALTER TABLE ADD CONSTRAINT`
avec des noms déterministes, et propose `AUTO_INCREMENT` ou `SERIAL` selon
le dialecte.

**Sauvegarde et export.** Format `meriz-mcd` version 2, avec contrôle de
forme complet à l'ouverture et migration automatique des fichiers version 1.
Le contrôle revérifie les cardinalités à l'exécution. L'autosauvegarde écrit
dans `localStorage` à chaque changement d'état. `saveFileAs` utilise le
sélecteur de fichier natif quand le navigateur le propose, et retombe sur un
téléchargement sinon.

**Version web.** Le site vitrine et l'application sont en ligne et
fonctionnent, mais ils ont été posés à la main sur le VPS. Le workflow
`deploy-web.yml` échoue à chaque push depuis sa création (voir la section 5).

---

## 3. Architecture actuelle

### Structure des dossiers

```
src/
  model/        source de vérité : types, reducers, validation, dérivations
  canvas/       rendu React Flow : nœuds, liens, transformations vers Flow
  components/   interface : vues, formulaires, panneaux
  lib/          utilitaires : identifiants, persistance, téléchargement, PNG
site/           vitrine statique (HTML et CSS vanille, zéro dépendance)
src-tauri/      application de bureau (Rust, icônes, configuration)
deploy/         gabarits de VirtualHost Apache et de serveur nginx
examples/       universite.meriz.json, modèle de démonstration
.github/        workflows release.yml et deploy-web.yml
```

Le découpage exigé par CLAUDE.md est respecté à la lettre. Aucun fichier de
`src/model` n'importe React ni React Flow.

### Modules clés

| Fichier | Lignes | Rôle |
|---|---|---|
| `src/model/mcd.ts` | 97 | Les types du modèle. Rien d'autre. |
| `src/model/invariants.md` | 42 | Les 17 règles de validité, spécification de `validate.ts`. |
| `src/model/mcdReducer.ts` | 357 | Toutes les actions utilisateur, fonction pure. |
| `src/model/historyReducer.ts` | 78 | Annuler / rétablir autour du reducer. |
| `src/model/validate.ts` | 291 | Erreurs et avertissements. |
| `src/model/mld.ts` | 197 | Règles de passage MCD vers MLD. |
| `src/model/mpd.ts` | 206 | Types SQL, tri topologique, génération du script. |
| `src/lib/persistence.ts` | 347 | Format de fichier, migration v1, autosauvegarde. |
| `src/canvas/McdCanvas.tsx` | 231 | Le canvas et son état de vue local. |
| `src/components/LearnView.tsx` | 504 | La page pédagogique. |

### Forme du modèle

```ts
ATTRIBUTE_TYPES = ['texte','entier','decimal','booleen','date','datetime','heure']
AttributeType   = (typeof ATTRIBUTE_TYPES)[number]

Cardinality  { min: 0 | 1; max: 1 | 'n' }
Property     { id, name, type: AttributeType, size?: number }
PropertyRef  { propertyId, isIdentifier }
Entity       { id, name, attributes: PropertyRef[] }
Leg          { id, entityId, cardinality, role? }
Association  { id, name, attributes: PropertyRef[], legs: Leg[] }
Mcd          { properties: Property[], entities: Entity[], associations: Association[] }

McdLayout    Record<string, { x, y }>   positions des nœuds ET des étiquettes de pattes
```

Le type `Cardinality` interdit à la compilation toute autre valeur que
(0,1), (1,1), (0,n) et (1,n).

### Gestion d'état

Un seul `useReducer` dans `App.tsx`, sur `historyReducer`, qui enveloppe
`mcdReducer`. L'état historisé est exactement `{ mcd, layout }`. La
sélection, la vue active et les réglages MPD sont des `useState` séparés,
volontairement hors de l'historique.

`historyReducer` fusionne les actions continues grâce à une signature
`type:cibleId` : huit frappes dans un champ de nom ne font qu'une seule
étape d'annulation. La pile est plafonnée à 100 étapes. Un refus silencieux
du reducer (même référence retournée) n'entre pas dans l'historique.

Les vues MLD, MPD et SQL ne sont pas un état stocké : ce sont des `useMemo`
purs qui dérivent du MCD courant dès que `generatedAt` est renseigné. Il ne
peut donc pas y avoir de divergence entre le MCD et ce qui est affiché.
Quand le modèle contient des erreurs, une bannière le signale au lieu de
figer un résultat périmé.

---

## 4. Ce qui a été fait par rapport au plan

Déduit du code, pas des intentions.

| Étape | Réalisée | Preuve dans le code |
|---|---|---|
| 00 Squelette Vite, React, TS, Tailwind, React Flow | Oui | `vite.config.ts`, `package.json`, Tailwind v4 via `@tailwindcss/vite`. |
| 01 Modèle MCD et invariants | Oui | `mcd.ts` et `invariants.md`. |
| 02 Canvas et reducer | Oui | `McdCanvas.tsx`, `mcdReducer.ts`, `mcdToFlow.ts`. |
| 03 Inspecteur et validation | Oui | `Inspector.tsx`, `validate.ts`, `ProblemsPanel.tsx`. |
| 04 Fichiers et export PNG | Oui | `persistence.ts`, `exportImage.ts`, `FileActions.tsx`. |
| 05 Coquille applicative | Oui | `NavRail.tsx`, `TopBar.tsx`, `views.ts`. |
| 06 à 08 MLD, MPD, SQL | Oui | `mld.ts`, `mpd.ts`, et les trois vues. |
| 09 Page Apprendre | Oui | `LearnView.tsx`, neuf sections plus glossaire. |
| 10 À propos et licence | Oui | `AboutView.tsx` avec le texte MIT complet. |
| 11 Application Tauri | Oui | `src-tauri/`, `release.yml`, release `v0.1.0` publiée. |
| 12 Déploiement web | Partiel | Le site tourne, mais le workflow automatique échoue. |
| 13 Site vitrine | Oui | `site/index.html`, `site/telecharger.html`, `site/style.css`. |

Écarts entre le code et CLAUDE.md, à corriger un jour dans CLAUDE.md
lui-même :

1. CLAUDE.md dit encore, en « Hors périmètre pour l'instant », qu'il n'y a
   « pas de génération MLD, MPD ni SQL ». Cette limite a été levée en cours
   de route et les trois niveaux sont livrés. La section est périmée.
2. CLAUDE.md annonce Tauri comme « plus tard ». C'est fait.
3. L'héritage et la spécialisation Merise restent bien hors périmètre, et
   rien dans le code ne les amorce. Cet écart-là n'existe pas.

---

## 5. Bugs connus et points en suspens

Classés du plus gênant au plus anodin.

**1. Le déploiement web automatique échoue à chaque push.** Les huit
derniers lancements du workflow `Deploy web` sont en échec, y compris sur le
dernier commit `c72ea2b`. Cause : les secrets `VPS_HOST`, `VPS_USER`,
`VPS_SSH_KEY` et `VPS_PATH` n'ont jamais été créés dans les réglages du
dépôt. Conséquence pratique : toute modification du site ou de l'application
demande une mise à jour manuelle sur le VPS, par exemple
`cd /home/mmi25b06/meriz && git pull && cp -r site/. /var/www/meriz/`.
Le workflow `Release` fonctionne, lui.

**2. Ctrl+Z écrase l'annulation native dans les champs de saisie.** Dans
`App.tsx`, le gestionnaire d'annulation écoute la fenêtre entière sans
vérifier la cible, contrairement au Ctrl+A juste au-dessus qui, lui, ignore
les `input`, `textarea` et `select`. Taper un nom d'entité puis faire Ctrl+Z
annule donc l'action de modèle au lieu de la frappe. C'est en partie masqué
par la fusion des actions continues, mais le comportement reste surprenant.

**3. L'état « généré » ne survit pas au rechargement.** `generatedAt` est un
`useState` initialisé à `null` et jamais mémorisé, alors que le modèle,
lui, est restauré par l'autosauvegarde. Après un rechargement de page, les
vues MLD, MPD et SQL réaffichent donc l'écran « rien à afficher » tant qu'on
n'a pas recliqué sur Générer, alors que le MCD est bien revenu.

**4. Les positions du diagramme MPD sont perdues à chaque changement de
vue.** `MpdView` est monté conditionnellement dans `App.tsx`, donc démonté
dès qu'on quitte la vue. Les positions des tables vivent dans un `useState`
local à `MpdDiagram`, jamais dans le layout ni dans le fichier. Ranger le
diagramme puis aller voir le SQL suffit à tout remettre en grille. La vue
MCD, elle, est masquée et non démontée, et ne souffre pas du problème.

**5. Création de patte impossible au clavier.** Relier une association à une
entité passe uniquement par un glisser de handle à la souris. Aucun
formulaire ne propose « relier à une entité ». Le déplacement des étiquettes
de cardinalité est également réservé à la souris. C'est un écart réel avec
l'exigence forte d'accessibilité de CLAUDE.md, qui demande que tout soit
utilisable au clavier. Le reste de l'application tient l'objectif : le
déplacement des nœuds aux flèches fonctionne, les focus sont visibles,
l'information ne repose jamais sur la couleur seule.

**6. La taille d'une propriété ne s'édite que dans le Dictionnaire.**
`AttributesEditor` propose le nom, le type, la case clé et le retrait, mais
pas le champ Taille. Pour dimensionner un `VARCHAR`, il faut passer par la
vue Dictionnaire. Cohérent avec l'idée de dictionnaire maître, mais peu
évident quand on travaille dans l'inspecteur.

**7. `src/model/example.ts` est du code mort.** Ses exports `exampleMcd` et
`exampleLayout` ne sont importés nulle part, depuis que l'application démarre
sur un modèle vide. Soixante-dix lignes qui ne servent plus. Ni `tsc` ni
`oxlint` ne le signalent, puisque les symboles sont exportés.

**8. L'exemple n'est pas chargeable depuis l'application.** `HomeView`
indique le chemin `examples/universite.meriz.json` en texte, mais aucun
bouton ne l'ouvre. L'utilisateur doit trouver le fichier dans le dépôt.

**9. Le README est vide.** Il contient une seule ligne, `# meriz`, alors que
CLAUDE.md consacre une section entière au style à tenir dedans. Pour un
projet qui se présente comme open source et accueillant aux contributions,
c'est le manque le plus visible de l'extérieur.

**10. Aucun test automatisé.** Pas de Vitest, pas de fichier `.test.ts`, pas
de lanceur dans les dépendances. Les règles de passage Merise, qui sont le
cœur de valeur du projet, ne sont protégées par rien contre une régression.
Elles ont été vérifiées à la main, y compris pendant cet audit, mais rien ne
rejouera cette vérification automatiquement.

**11. Numéros de version incohérents.** `package.json` déclare `0.0.0`,
`src-tauri/tauri.conf.json` déclare `0.1.0`, et la release publiée est
`v0.1.0`. Sans conséquence fonctionnelle, mais à aligner.

**12. Un fichier non commité.** `.claude/settings.json` a dix lignes de
permissions ajoutées, non commitées. Sans effet sur l'application.

Rien dans le code n'est marqué `TODO` ou `FIXME`. Aucune partie n'est cassée
au sens strict : tout ce qui est branché fonctionne.

---

## 6. Comment lancer, et santé du code

### Commandes

```bash
npm install          # installer les dépendances
npm run dev          # serveur de développement, http://localhost:5173
npm run build        # tsc -b puis vite build, sortie dans dist/
npm run preview      # servir le build de production
npm run lint         # oxlint
npm run tauri dev    # application de bureau en développement
npm run tauri build  # installateurs de bureau
```

### Résultats réels, exécutés pendant cet audit

**Types (`npx tsc -b --force`) : succès, code 0.** Aucune erreur. TypeScript
6.0 en mode `strict`, avec en plus `noUnusedLocals`, `noUnusedParameters`,
`erasableSyntaxOnly` et `noFallthroughCasesInSwitch`.

**Lint (`npx oxlint`) : succès, code 0.** Aucun avertissement.

**Build (`npm run build`) : succès, code 0, en 2,10 secondes.**

```
dist/index.html                   1,05 ko  (gzip  0,54 ko)
dist/assets/index-CXLBZfaF.css   39,48 ko  (gzip  7,94 ko)
dist/assets/index-kE0rD9Qh.js   484,06 ko  (gzip 149,85 ko)
```

**Chaîne complète, vérifiée sur `examples/universite.meriz.json`** au moyen
d'un script jetable exécuté hors du dépôt :

```
PARSE OK
ERREURS = 0 | AVERTISSEMENTS = 0
TABLES = 8
    Etudiant (numeroEtudiant, nomEtudiant, prenomEtudiant, dateNaissance,
              boursier, #codeDiplome, #tuteur_numeroEtudiant)
    Cours (codeCours, intituleCours, coefficient)
    Enseignant (numeroEnseignant, nomEnseignant, emailEnseignant)
    Salle (numeroSalle, capacite)
    Seance (numeroSeance, debutSeance, dureeSeance, #codeCours, #numeroSalle)
    Diplome (codeDiplome, libelleDiplome)
    inscrire (#numeroEtudiant, #codeCours, noteFinale)
    enseigner (#numeroEnseignant, #codeCours)
SQL LIGNES = 82
```

Les trois règles de passage se vérifient sur ce résultat : la clé étrangère
part bien du côté à maximum 1 (`Etudiant` reçoit `codeDiplome`), le réflexif
préfixe la colonne par le rôle (`tuteur_numeroEtudiant`), et les
associations sans côté à maximum 1 deviennent des tables de jonction à clé
composée (`inscrire`, `enseigner`).

### Qualité de code observée

Aucun `any` dans `src`, aucun `@ts-ignore`, aucune désactivation de règle de
lint. Sept assertions non nulles `!` au total, toutes dans `mld.ts`,
`mpd.ts` et `validate.ts`, sur des accès garantis par une vérification
juste au-dessus. Les commentaires sont en français et expliquent des règles
Merise, comme demandé. Aucun tiret long dans le code ni dans l'interface.

---

## 7. État Git

- Branche courante : `main`
- Dernier commit : `c72ea2b`, « Page Télécharger : avertissements de premier lancement visibles d'emblée »
- Synchronisation avec `origin/main` : à jour, zéro commit d'avance, zéro de retard
- Modifications non commitées : un seul fichier, `.claude/settings.json`, dix lignes de permissions ajoutées. Aucun fichier de l'application n'est modifié.
- Historique : treize commits, du squelette initial jusqu'à la page de téléchargement.

---

## 8. Prochaines étapes possibles

Aucune n'est démarrée. Ordre suggéré, du plus utile au plus confortable.

1. **Écrire le README.** C'est la première chose que voit un visiteur du
   dépôt, et le seul livrable annoncé dans CLAUDE.md qui manque encore.
2. **Créer les quatre secrets GitHub** pour débloquer `deploy-web.yml`, et
   ne plus déployer à la main.
3. **Ajouter Vitest et couvrir `mld.ts`, `mpd.ts` et `validate.ts`.** Les
   règles de passage Merise sont le cœur du projet et rien ne les protège.
4. **Corriger le Ctrl+Z dans les champs de saisie**, avec le même garde que
   celui déjà écrit pour Ctrl+A quelques lignes plus haut.
5. **Mémoriser l'état « généré »** dans l'autosauvegarde, pour que les vues
   MLD, MPD et SQL survivent à un rechargement.
6. **Conserver les positions du diagramme MPD**, soit en gardant la vue
   montée comme le MCD, soit en les rangeant dans le layout.
7. **Ouvrir une voie clavier pour créer une patte**, par exemple un champ
   « relier à » dans le formulaire d'association. C'est le dernier vrai trou
   dans l'objectif d'accessibilité.
8. **Ajouter un bouton « Ouvrir l'exemple »** sur la page d'accueil, et
   supprimer `src/model/example.ts` s'il reste inutile, ou le rebrancher
   pour alimenter ce bouton.
9. **Aligner les numéros de version** entre `package.json`, Tauri et les
   tags Git.
10. **Mettre à jour la section « Hors périmètre » de CLAUDE.md**, devenue
    fausse sur la génération MLD, MPD, SQL et sur Tauri.
