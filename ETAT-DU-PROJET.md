# État du projet Meriz

Audit initial en lecture seule du code réel, effectué le 9 septembre 2026 sur le commit `c72ea2b`.
Mis à jour le 15 septembre 2026 après la stabilisation, commit `7e7b345`.

Ce rapport décrit ce qui existe dans le dépôt, pas ce qui était prévu.
Les points réglés depuis l'audit sont marqués **Réglé**, avec ce qui a été fait.

---

## 1. Vue d'ensemble

Meriz est une application web complète de modélisation Merise, fonctionnelle du début à la fin de la chaîne. On dessine un MCD dans un canvas, l'outil valide le modèle, puis dérive en direct le MLD, le MPD et un script SQL exécutable en MySQL ou PostgreSQL.

L'application existe sous trois formes :

- version web, sur `https://meriz.mmi25b06.mmi-troyes.fr/app/`
- logiciel de bureau Windows, macOS et Linux via Tauri, release `v0.1.0` publiée
- site vitrine statique à la racine du même domaine, avec une page de téléchargement

Les treize étapes prévues sont livrées. La stabilisation a réglé les quatre défauts relevés par l'audit, écrit le README, retiré le code mort, ajouté des tests sur les règles de passage et réparé le workflow de déploiement. Un seul point bloque encore l'automatisation complète : les secrets du VPS restent à créer à la main.

---

## 2. État par domaine

| Domaine | Statut | En une ligne |
|---|---|---|
| Modèle de données | Fait | `src/model/mcd.ts`, structure pure, sérialisable, aucune coordonnée de dessin. |
| Dictionnaire central | Fait | Propriétés définies une fois, placées au plus une fois, règle vérifiée par la validation. |
| Canvas MCD | Fait | React Flow contrôlé, glisser fluide, sélection multiple, suppression protégée. Les pattes se raccrochent au rond le plus proche à chaque image, et le tracé en cours se voit chez les autres. |
| Édition et inspecteur | Fait | Formulaires entité, association et patte. Création de patte au clavier ajoutée. |
| Commentaires et annotation | Fait | Fil de correction sur un travail, bulles posées sur le schéma, et crayon rouge éphémère du prof en correction à deux. |
| Validation | Fait | Deux niveaux, dix-sept invariants documentés, problèmes cliquables. |
| Vue MLD | Fait | Dérivée en direct du MCD, jamais vide après rechargement. |
| Vue MPD | Fait | Dérivée en direct, positions du diagramme conservées au changement de vue. |
| Vue SQL | Fait | Dérivée en direct, coloration, copie, export `.sql`, DROP optionnels. |
| Page Apprendre | Fait | Neuf sections plus un glossaire, sommaire ancré. |
| Sauvegarde et export | Fait | Format v2 avec migration v1, réglages MPD désormais enregistrés avec le modèle. |
| Coquille et navigation | Fait | Rail de vues, barre supérieure, réglage de taille d'interface. |
| Accueil et listes | Fait | Un tableau de bord par rôle, en deux colonnes. Les listes complètes vivent sur Mes classes et Mes groupes, avec une recherche par nom. |
| Système de design | Fait | Palettes chaudes en clair et en sombre, composants de base élevés, barres de défilement, bouton retour unique. Soixante paires de contrastes tenues au niveau AA. |
| Version PC (Tauri) | Fait | Configuration complète, workflow de release, `v0.1.0` publiée avec neuf fichiers. |
| Version web (déploiement) | Partiel | Workflow réparé et poussé. Il attend les secrets du VPS, à créer à la main. |
| Tests automatisés | Fait | 22 tests Vitest sur `mcdToMld`, `buildMpd` et `mpdToSql`. |
| README et licence | Fait | README complet, licence MIT déjà présente et confirmée. |

### Détail par domaine

**Modèle de données.** `Mcd` porte trois listes : `properties`, `entities`, `associations`. Les positions vivent à part dans `McdLayout`, un simple `Record<string, Position>`. Aucun fichier de `src/model` n'importe React Flow. Les sept types conceptuels sont un tuple `as const` dont le type dérive. Aucun type SQL ne remonte au niveau conceptuel.

**Dictionnaire central.** La règle d'unicité Merise est appliquée à deux endroits : le reducer refuse silencieusement un `PLACE_PROPERTY` sur une propriété déjà placée, et `validate` signale en erreur tout placement multiple. `DictionaryView` liste nom, type, taille, utilisation et placement, avec tri et suppression protégée.

**Canvas MCD.** `McdCanvas` tient un état local de vue pendant le glisser, et la position n'entre dans le layout qu'au `onNodeDragStop`, en une seule action `MOVE_NODES`.

Une patte s'accroche à l'un des quatre ronds posés sur le bord d'un bloc. Le côté est choisi par `anchors.ts`, à partir des positions vivantes de l'état local et des tailles mesurées, et recalculé à chaque image : le trait ne décroche donc jamais du bloc qu'on déplace, même vite, et il ne traverse ni la carte d'une entité ni la capsule d'une association. La règle compare la pente du segment à la diagonale du bloc, pas les seuls écarts, sinon une carte large recevrait un mauvais côté. Le modèle, lui, ne connaît aucun côté : `mcdToFlow` n'en pose plus, et un test le verrouille.

On tire depuis un rond d'une association et on lâche n'importe où sur une entité : un calque invisible couvre toute sa surface et ne reçoit le pointeur que pendant un tracé, donc le corps du bloc reste la poignée de déplacement. Les entités n'exposent que des ronds `target` et les associations des ronds `source`, et la règle `canCreateLeg` vérifie le sens dans le modèle, à la fois dans `isValidConnection` et dans `onConnect`.

Pendant qu'un participant tire une liaison, son tracé part dans la présence, comme son curseur : les autres voient un trait tireté à sa couleur, dessiné par `RemoteDraftLinks`. Ce tracé n'entre jamais dans le modèle, et la patte créée au lâcher ne compte que pour une seule étape d'annulation.

**Commentaires et annotation.** Le fil de correction d'un travail vit dans la colonne latérale de l'éditeur, sous l'inspecteur et les problèmes, replié par défaut et borné en hauteur. Tout passe par les routes du serveur (`commentsApi.ts`) : un commentaire général, ou une bulle posée à un endroit précis du schéma. Les bulles sont ancrées dans le repère du modèle, donc elles restent sur leur point au zoom et au déplacement, et leur état résolu se lit au texte, pas seulement à la couleur. Le serveur ne diffuse rien pour les commentaires : le fil se relit à l'ouverture, après chaque écriture, et toutes les dix secondes tant que le panneau est ouvert, en pause quand l'onglet est caché. Le fil ne dépend jamais de la barrière d'édition : en observation le modèle est verrouillé, mais commenter reste possible.

Le crayon rouge, lui, n'écrit rien. Le prof l'active en correction à deux, trace sur la zone de dessin, et l'élève voit le trait se faire : il part dans la présence, comme un curseur, borné à soixante-quatre points décimés et arrondis (`inkTrace.ts`). Il s'efface au lâcher du bouton, à l'arrêt de l'outil, en quittant la vue, et au départ du pair. Rien n'entre dans le modèle, rien n'est enregistré. En observation en lecture seule, aucun canal de présence n'est ouvert et le crayon n'existe pas : la discrétion de la lecture reste entière.

**Édition et inspecteur.** L'inspecteur édite un seul élément sélectionné. Le formulaire d'association contient désormais un bloc « Relier à une entité » (`LegConnector.tsx`) : liste des entités, bouton Relier, annonce accessible, focus rendu à la liste. Le sens association vers entité est garanti par l'action `ADD_LEG` et par `canCreateLeg`, couverte par un test.

**Accueil et listes.** L'accueil connecté est un tableau de bord, pas un déroulé. Une bande de trois chiffres, puis deux colonnes : à gauche ce qui se lit, à droite ce sur quoi on agit. Sous le point de bascule, tout s'empile dans cet ordre.

Le prof voit ses classes, ses élèves et ses rendus à corriger, puis la section « Demande votre attention » : les cinq rendus les plus anciens en attente de note, chacun ouvrant sa correction. Le chiffre et la liste viennent du **même appel**, car la page des rendus porte déjà son total. L'élève voit ses classes, ses groupes et ses devoirs à rendre, puis « À rendre » : les devoirs ni rendus ni notés, échéance la plus proche d'abord. Le tri est une fonction pure, `pendingAssignments`, et il ne recalcule aucun état : le serveur reste seul juge.

Ce qui faisait doublon a quitté l'accueil. Le panneau de création d'une classe et la grille complète des classes vivaient à la fois ici et sur Mes classes : ils ne vivent plus que là-bas. L'accueil n'en garde qu'un accès rapide, trois classes et trois groupes, avec le lien vers la liste. Deux blocs restent sur l'accueil et le code dit pourquoi : les raccourcis vers l'onglet Devoirs ou Cours d'une classe, que l'accès rapide ne remplace pas, et le formulaire « Rejoindre une classe » côté élève, parce que sans classe un élève ne peut rien faire.

Les pages Mes classes et Mes groupes portent une recherche par nom, filtrée à la frappe, sans appel au serveur : les deux listes arrivent entières. Le pli de comparaison retire les accents et la casse mais **garde les séparateurs**, contrairement à `normalizeName` du modèle qui les supprime tous pour apparier des noms Merise. « ELEVES » trouve donc « Élèves de seconde », et « abc » ne trouve pas « a b c ». Le champ ne s'affiche qu'au-delà de six entrées, le compte se dit dans une région polie, et le vide après recherche ne porte pas le même texte qu'une liste vide.

**Système de design.** Les couleurs sont des tokens sémantiques, définis une fois en clair et une fois en sombre dans `src/index.css`. Aucun composant ne porte de couleur en dur, et `src/design/contrast.test.ts` lit les tokens dans la feuille de style pour vérifier **soixante paires** de texte sur fond, dans les deux thèmes : 4,5 pour du texte, 3 pour un contour ou un trait. On ne baisse jamais un minimum pour faire passer une couleur, on change la couleur.

L'ambiance est chaude, et chaque thème la porte à sa façon. En clair, le fond est un papier tiède, l'encre un presque-noir légèrement brun, les gris secondaires du taupe. En sombre, le fond est une nuit indigo : chaque neutre tient à moins de sept degrés de teinte de l'accent, donc un bouton bleu s'y pose sans jurer, là où le brun d'avant s'en trouvait à cent trente-neuf degrés et se battait avec lui. Le rouge reste au-dessus du vert dans tous ces gris, ce qui évite le gris bleu clinique, et c'est l'encre ivoire qui porte la chaleur, comme une lampe chaude dans une pièce bleue. L'indigo du logo ne sert qu'à l'accent, aux liens, au focus et aux traits du schéma : il est rare, donc il ressort. Le fond de page vit à trois endroits qui doivent rester d'accord, `--c-shell` dans la feuille de style, `THEME_COLORS` dans `theme.ts` et les deux valeurs d'`index.html` ; sans quoi la barre du navigateur mobile jure avec la page.

Les formes et les ombres sont des tokens aussi. Trois rayons, du contrôle au panneau, et deux ombres à deux couches : un liseré près du bord qui pose l'objet, une diffusion large et faible qui fait la chaleur. En sombre, c'est la bordure qui porte l'élévation. Les boutons passent tous par `buttonClass`, donc une retouche là élève les quarante fichiers qui s'en servent, et chaque survol garde un couple texte et fond vérifié. Le contour de focus n'impose plus de rayon : il épouse la forme de l'élément, donc une pastille reste ronde quand elle reçoit le focus.

La base de texte est à 17 px, un cran plus confortable que le 16 px des navigateurs. Le réglage Aa garde ses quatre crans autour de cette base, de 15 à 21 px. Les barres de défilement sont posées une fois pour toute l'application : un pouce arrondi au ton des contours, aucun rail, ce que Firefox prend par ses deux propriétés et ce dont le bureau Tauri hérite par les règles WebKit. Le retour est un seul composant, `BackButton`, à plat sur les pages et encadré dans l'en-tête de l'éditeur, avec une flèche tracée plutôt qu'un caractère, parce qu'un glyphe dépend de la police chargée.

**Validation.** `validate.ts` produit erreurs et avertissements en français. Chaque problème porte un `elementId` qui le rend cliquable vers l'élément fautif.

**MLD, MPD et SQL.** Les trois règles de passage sont implémentées dans `mld.ts` et désormais verrouillées par des tests. Les trois vues dérivent en permanence du MCD courant. Elles affichent un message seulement quand le MCD n'a aucune entité, et un bandeau quand il contient des erreurs.

**Sauvegarde et export.** Format `meriz-mcd` version 2, avec un nouveau champ facultatif `mpd` qui porte le dialecte et les surcharges de types. Les anciens fichiers s'ouvrent toujours. L'autosauvegarde écrit modèle, positions et réglages MPD sous une seule clé. L'ancienne clé `meriz-mpd-settings` n'est plus que relue en repli.

**Version web.** Le site et l'application tournent sur le VPS, posés à la main jusqu'ici. Le workflow corrigé est poussé. Son premier lancement, sur `7e7b345`, s'arrête comme prévu à l'étape « Vérifier les secrets ». Dès que les secrets existent, chaque push sur `main` déploiera tout seul.

---

## 3. Architecture actuelle

### Structure des dossiers

```
src/
  model/        source de vérité : types, reducers, validation, dérivations, tests
  canvas/       rendu React Flow : nœuds, liens, transformations vers Flow
  components/   interface : vues, formulaires, panneaux
  lib/          utilitaires : identifiants, persistance, téléchargement, PNG, clavier
site/           vitrine statique (HTML et CSS vanille, zéro dépendance)
src-tauri/      application de bureau (Rust, icônes, configuration)
deploy/         gabarits Apache et nginx, guide DEPLOIEMENT.md
examples/       universite.meriz.json, modèle de démonstration
.github/        workflows release.yml et deploy-web.yml
```

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
| `src/model/mld.test.ts`, `mpd.test.ts` | 95 + 92 | Tests des règles de passage et du SQL. |
| `src/model/testFixtures.ts` | 187 | MCD de référence des tests. |
| `src/lib/persistence.ts` | 362 | Format de fichier, migration v1, réglages MPD, autosauvegarde. |
| `src/lib/keyboard.ts` | 16 | Garde des raccourcis globaux dans les champs de saisie. |
| `src/canvas/McdCanvas.tsx` | 231 | Le canvas et son état de vue local. |
| `src/components/LegConnector.tsx` | 75 | Création de patte au clavier. |

Comptes de lignes non vides.

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
MpdSettings  { dialect: 'mysql' | 'postgresql', overrides: Record<string, string> }
```

### Gestion d'état

Un seul `useReducer` dans `App.tsx`, sur `historyReducer`, qui enveloppe `mcdReducer`. L'état historisé est exactement `{ mcd, layout }`. La sélection, la vue active et les réglages MPD sont des `useState` séparés, hors de l'historique. Les réglages MPD sont sauvegardés avec le modèle.

`historyReducer` fusionne les actions continues grâce à une signature `type:cibleId`, et plafonne la pile à 100 étapes.

Les tables MLD et MPD sont des `useMemo` purs recalculés à chaque changement du MCD ou des réglages. Il n'existe plus d'état « généré » : le bouton Générer vérifie le modèle puis ouvre la vue MLD.

Les vues MCD et MPD restent montées quand elles sont masquées. C'est ce qui conserve le zoom du canvas MCD et les positions du diagramme MPD.

---

## 4. Ce qui a été fait par rapport au plan

| Étape | Réalisée | Preuve dans le code |
|---|---|---|
| 00 Squelette Vite, React, TS, Tailwind, React Flow | Oui | `vite.config.ts`, `package.json`. |
| 01 Modèle MCD et invariants | Oui | `mcd.ts` et `invariants.md`. |
| 02 Canvas et reducer | Oui | `McdCanvas.tsx`, `mcdReducer.ts`, `mcdToFlow.ts`. |
| 03 Inspecteur et validation | Oui | `Inspector.tsx`, `validate.ts`, `ProblemsPanel.tsx`. |
| 04 Fichiers et export PNG | Oui | `persistence.ts`, `exportImage.ts`, `FileActions.tsx`. |
| 05 Coquille applicative | Oui | `NavRail.tsx`, `TopBar.tsx`, `views.ts`. |
| 06 à 08 MLD, MPD, SQL | Oui | `mld.ts`, `mpd.ts`, et les trois vues. |
| 09 Page Apprendre | Oui | `LearnView.tsx`. |
| 10 À propos et licence | Oui | `AboutView.tsx`, `LICENSE`. |
| 11 Application Tauri | Oui | `src-tauri/`, `release.yml`, release `v0.1.0`. |
| 12 Déploiement web | Partiel | Workflow réparé. Secrets du VPS à créer (étape manuelle). |
| 13 Site vitrine | Oui | `site/index.html`, `site/telecharger.html`. |
| Stabilisation A : correctifs | Oui | `keyboard.ts`, `LegConnector.tsx`, `App.tsx`, `MpdView.tsx`. |
| Stabilisation B : ménage et tests | Oui | `README.md`, `mld.test.ts`, `mpd.test.ts`, `example.ts` supprimé. |
| Stabilisation C : déploiement | Oui côté dépôt | `deploy-web.yml`, `deploy/DEPLOIEMENT.md`. |

**Réglé.** Les écarts entre CLAUDE.md et le code sont corrigés dans CLAUDE.md : la génération MLD, MPD et SQL et l'application Tauri y sont désormais marquées comme livrées.

---

## 5. Bugs connus et points en suspens

### Réglés pendant la stabilisation

**1. Déploiement web automatique.** **Réglé côté dépôt, en attente de vos secrets.** Voici ce qui a changé dans le workflow :
- une étape nomme les secrets manquants ;
- la clé passe par `env:` ;
- l'empreinte d'hôte est vérifiée par le secret `VPS_KNOWN_HOSTS` ;
- la connexion et le droit d'écriture sont testés avant l'envoi ;
- `npm test` passe avant le build ;
- les droits des fichiers sont forcés pour Apache ;
- relance manuelle et un seul déploiement à la fois.

La marche à suivre est dans `deploy/DEPLOIEMENT.md`. Tant que les secrets manquent, chaque push échoue à la première étape, avec la liste des secrets absents.

**2. Ctrl+Z dans les champs de saisie.** **Réglé.** Ctrl+Z, Ctrl+Y et Ctrl+Maj+Z ignorent désormais les champs de saisie, les listes et les zones éditables. Ils passent par la même garde que Ctrl+A, `isEditableTarget`. Dans un champ, le navigateur annule la frappe.

**3. Vues générées vides après rechargement.** **Réglé.** L'état `generatedAt` est supprimé. MLD, MPD et SQL dérivent toujours du MCD. Les réglages MPD sont enregistrés dans l'autosauvegarde et dans les fichiers.

**4. Positions du diagramme MPD perdues.** **Réglé.** La vue MPD reste montée et masquée, comme la vue MCD.

**5. Création de patte impossible au clavier.** **Réglé.** Le bloc « Relier à une entité » dans l'inspecteur d'association rend le parcours possible au seul clavier, avec une annonce accessible.

**6. Code mort `src/model/example.ts`.** **Réglé.** Fichier supprimé. Son cas Client passe Commande sert désormais de fixture de test.

**7. README vide.** **Réglé.** README complet : présentation, commandes, application de bureau, structure, licence.

**8. Aucun test automatisé.** **Réglé.** 22 tests Vitest couvrent les règles suivantes :
- clé étrangère du bon côté ;
- table de jonction à clé composée ;
- rôle en préfixe pour le réflexif ;
- identifiant composé ;
- ordre du SQL ;
- dialectes et surcharges de types.

### Restent ouverts

**9. Secrets du VPS à créer.** Étape manuelle, décrite pas à pas dans `deploy/DEPLOIEMENT.md`. C'est le seul point qui empêche encore le déploiement automatique.

**10. Contrôle manuel des correctifs dans le navigateur.** Les correctifs sont vérifiés par types, build, tests et scripts, mais pas encore à la main dans l'interface. À faire en priorité : le cadrage du diagramme MPD au premier affichage, puisque la vue est montée masquée.

**11. La taille d'une propriété ne s'édite que dans le Dictionnaire.** L'inspecteur propose nom, type, clé et retrait, mais pas la taille.

**12. L'exemple n'est pas chargeable depuis l'application.** `HomeView` cite le chemin `examples/universite.meriz.json`, sans bouton pour l'ouvrir.

**13. Numéros de version incohérents.** `package.json` déclare `0.0.0`, Tauri déclare `0.1.0`, et la release est `v0.1.0`.

**14. Deux failles signalées par `npm audit`.** `nanoid` et `postcss`, niveau high, présentes avant la stabilisation. Ce sont des outils de build, absents du code livré. Leur correction ferait monter d'autres versions, elle est à mener à part.

**15. Lock npm fragile.** Une installation incrémentale retire du lock les paquets WebAssembly optionnels `@emnapi`, et casse `npm ci`. Après tout ajout de dépendance, lancez `npm ci` avant de pousser.

**16. `.claude/settings.json`.** **Réglé.** Il contient des permissions d'outils accumulées, dont certaines larges. Il est désormais ignoré par Git et retiré du dépôt. La copie locale reste en place. Il figure encore dans l'historique des commits passés, sans secret.

---

## 6. Comment lancer, et santé du code

### Commandes

```bash
npm install          # installer les dépendances
npm run dev          # serveur de développement, http://localhost:5173
npm run build        # tsc -b puis vite build, sortie dans dist/
npm run preview      # servir le build de production
npm run lint         # oxlint
npm test             # tests Vitest
npm run tauri dev    # application de bureau en développement
npm run tauri build  # installateurs de bureau
```

### Résultats réels, derniers lancements avant le commit `7e7b345`

- **Tests (`npm test`) : succès.** 2 fichiers, 22 tests passés.
- **Types et build (`npm run build`) : succès.** `tsc -b` sans erreur. Sortie : `index-tia1Pmc2.js` 485,79 ko (gzip 150,13 ko), `index-CXLBZfaF.css` 39,48 ko.
- **Lint (`npx oxlint`) : succès.** Aucun avertissement.
- **Lock (`npm ci`) : succès.** `npm ls` sans paquet invalide ni manquant.
- **Workflow de déploiement :** YAML validé par un parseur, chaque script `run` passe `bash -n`, étape de vérification des secrets testée sans secret, avec un secret manquant et avec tous.

La stabilisation B n'a pas changé l'application : ses fichiers JS et CSS gardent exactement la même empreinte avant et après.

### Qualité de code observée

Aucun `any` dans `src`, aucun `@ts-ignore`, aucune désactivation de règle de lint. Les commentaires sont en français et expliquent des règles Merise. Aucun tiret long dans le code, l'interface ni la documentation.

---

## 7. État Git

- Branche courante : `main`
- Dernier commit : `7e7b345`, « Stabilisation : correctifs, ménage, tests et déploiement »
- Synchronisation avec `origin/main` : poussé, à jour
- Modifications non commitées : aucune. `.claude/settings.json` est ignoré par Git (voir point 16).
- Historique : quinze commits, le dernier ajoutant ce rapport à jour et la règle d'ignore.

---

## 8. Prochaines étapes possibles

Aucune n'est démarrée. Ordre suggéré.

1. **Créer les secrets du VPS** en suivant `deploy/DEPLOIEMENT.md`, puis relancer le workflow depuis l'onglet Actions pour valider un premier déploiement automatique.
2. **Tester les correctifs à la main** dans `npm run dev` : Ctrl+Z dans un champ, rechargement, positions MPD, patte au clavier.
3. **Aligner les numéros de version** entre `package.json`, Tauri et les tags Git.
4. **Ajouter un bouton « Ouvrir l'exemple »** sur la page d'accueil.
5. **Rendre la taille éditable dans l'inspecteur**, pour ne plus devoir passer par le Dictionnaire.
6. **Traiter les deux failles `npm audit`**, puis vérifier que `npm ci`, les tests et le build restent verts.
7. **Ajouter `npm test` au workflow de release**, pour qu'aucun installateur ne soit publié avec une règle de passage cassée.
