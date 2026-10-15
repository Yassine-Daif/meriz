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
| Écrans de création | Fait | Compositeur de cours à deux onglets, éditeur de devoir en sections, gestion de groupe alignée sur celle des classes. Le focus suit chaque geste. |
| Classe et groupe | Fait | La gestion vit dans son onglet Réglages, ouvert par défaut à la création seulement. Cartes de membre de hauteur égale, et retour en haut sur les pages longues. |
| Finition du schéma | Fait | Focus clavier rendu visible dans la zone de dessin, sélection qui se signale par la forme, aide d'accessibilité en français, et plus aucune valeur de taille écrite en dur dans l'application. |
| Cadrage du MPD | Fait | La vue s'ouvre centrée à la bonne échelle, et garde son cadrage et ses tables déplacées au retour. |
| Vérification d'email | Fait | Le lien reçu par courrier ouvre une page qui annonce son résultat, sans exiger de compte. Le profil montre l'état de l'adresse et renvoie le lien. |
| Mes données | Fait | Export de toutes ses données en un fichier, et suppression définitive du compte après mot de passe et case cochée, sans trace locale. |
| Poids du premier chargement | Fait | L'éditeur, React Flow et Yjs arrivent à l'ouverture d'un document : l'entrée passe de 278 à 148 kilos compressés. |
| Lisibilité d'App.tsx | Fait | Les onze chemins d'ouverture, l'observation en direct et l'offre d'import vivent dans des hooks nommés. La fonction App passe de 693 à 354 lignes. |
| Système de design | Fait | Palettes chaudes en clair et en sombre, composants de base élevés, barres de défilement, bouton retour unique. Soixante paires de contrastes tenues au niveau AA. |
| Version PC (Tauri) | Fait | Configuration complète, workflow de release, `v0.1.0` publiée avec neuf fichiers. |
| Version web (déploiement) | Partiel | Workflow réparé et poussé. Il attend les secrets du VPS, à créer à la main. |
| Tests automatisés | Fait | 22 tests Vitest sur `mcdToMld`, `buildMpd` et `mpdToSql`. |
| README et licence | Fait | README complet. Le projet est passé de MIT à la GNU AGPL 3.0 : une version modifiée et distribuée reste ouverte et crédite l'auteur. |

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

**Écrans de création.** Les trois écrans où l'on fabrique quelque chose, un cours, un devoir, un groupe, partagent désormais le même squelette : une racine qui tient le rythme, et des sections au même dessin, posées par `FormSection`. Cette brique engendre l'identifiant du titre et le relie à la section : écrite à la main, la relation s'oubliait, et deux sections finissaient par porter le même identifiant en dur.

Le compositeur de cours gagne deux onglets, Écrire et Aperçu. L'aperçu monte `LessonPage`, le composant que lit l'élève, sans adaptation : le prof voit donc sa page telle qu'elle sera, titres et textes compris, là où il ne voyait avant qu'un aperçu par bloc média. Chaque carte de bloc porte son nom lu, « Bloc 2 sur 6, Texte », et les six boutons d'ajout disent le verbe. Le focus suit l'action : dans le premier champ du bloc neuf après un ajout, sur la carte qui prend la place après un retrait, sur le bouton qui remplace le précédent après une publication. Le déplacement gardait déjà ce soin, les autres gestes ne l'avaient pas.

L'éditeur de devoir se range en sections, Énoncé, Image, Base et corrigé, Diffusion, puis une zone de suppression à part. La date limite passe par `FormField` : son aide, son erreur et son état invalide se relient au champ, ce que la version écrite à la main ne faisait pour aucun des trois. Chaque état est collé au bouton qui le change, et le corrigé ne peut plus être libéré avant d'exister.

La gestion d'un groupe s'aligne sur celle d'une classe : le code dans une puce encadrée avec son libellé, les panneaux Membres et Documents devenus de vraies sections. Deux défauts tombent au passage. Sans code, le panneau de gestion disparaissait **en emportant le seul bouton de suppression** ; il reste maintenant et dit que le code n'est pas disponible. Et les erreurs des documents partaient par le canal des succès, donc s'affichaient en vert avec une coche ; elles ont maintenant le leur.

**Classe et groupe.** Le bloc de gestion, le code et ses boutons, était posé au-dessus des onglets : il restait à l'écran quoi qu'on regarde, et il fallait le refaire défiler à chaque changement d'onglet. Il vit maintenant dans un onglet **Réglages**, qui n'existe que pour le prof d'une classe ou le créateur d'un groupe. Un onglet de réglages reçu par quelqu'un qui n'y a pas droit retombe sur les membres, plutôt que de mener à un panneau vide.

L'onglet d'arrivée suit une règle simple, et sans rien mémoriser : la création passe `tab: 'reglages'` dans l'objet d'ouverture que les deux pages transmettaient déjà, donc le créateur voit son code tout de suite. Toute autre ouverture garde la liste des membres, qui était déjà le comportement.

Les cartes de membre ne se déforment plus. Chacune porte une ossature fixe, avatar et nom, puis **deux emplacements de hauteur tenue**, la date d'arrivée et le contact. Un emplacement vide garde sa place, donc un profil rempli et un profil vide donnent la même hauteur, ce qu'un essai mesure au pixel. La présentation reste repliée et vient en dernier, pour que son ouverture pousse vers le bas sans décaler ce qui précède. Les deux listes, classe et groupe, emploient la même carte, là où l'une posait un élément écrit à la main et l'autre une carte au rembourrage différent.

Sur les pages longues, un bouton ramène en haut. Il est posé une seule fois dans la coquille de l'espace connecté, car c'est la zone de contenu qui défile, et il ne se montre qu'au-delà d'un écran. Le retour est doux, sauf si le système demande moins de mouvement : `scrollTo` est une interface de script, que la règle CSS du dépôt ne couvre pas, donc la préférence se lit à la main. Ensuite le focus va au titre de la page, sans quoi la tabulation repartirait du bas du document.

**Finition du schéma.** La zone de dessin portait trois défauts que seul un audit sérieux fait sortir. Le premier est un manquement : la feuille de React Flow pose `outline: none` sur `.react-flow__node.selectable:focus-visible`, deux classes et une pseudo-classe, ce qui l'emportait sur la règle générale de l'application. **Se déplacer au clavier dans un schéma ne se voyait pas.** Une règle aussi précise, posée après, rétablit le contour. Le deuxième : une table du MPD n'avait aucun signe de sélection, parce que `TableNode` ne lisait pas `selected` et que le style par défaut de React Flow ne vise jamais les types de nœuds maison. Le troisième : la colonne étrangère du MPD portait bien son `#`, mais masqué aux lecteurs d'écran, donc elle ne s'en distinguait que par sa couleur.

La sélection d'un bloc gagne un écart. L'anneau se détache du bord au lieu de s'y coller : une bague séparée se lit comme une forme qui apparaît, là où un liseré collé se lit comme une teinte qui change. La largeur du bord, elle, ne bouge pas : un pixel de plus et la boîte du nœud grandirait, donc les pattes sauteraient.

L'aide d'accessibilité de React Flow parlait anglais au milieu d'une interface française. Elle est traduite, sur les deux zones de dessin.

Les curseurs des autres portaient un anneau censé les détacher du fond. Mesuré, il valait **1,04** de contraste en clair et 1,08 en sombre : il ne séparait rien. C'est l'ombre qui fait le travail, elle est renforcée et l'anneau s'en va. Les pastilles, elles, sont lisibles par construction : les dix couples de la palette d'avatars tiennent 7,97 au minimum.

**Plus aucune valeur de taille écrite en dur.** Dix-neuf `text-[Npx]` traînaient dans l'application, surtout dans la page Apprendre. Deux d'entre elles sont *sous* le plus petit cran de l'échelle : les monter aurait grossi les nœuds du schéma et déplacé les pattes. Elles sont donc déclarées comme tokens à leur valeur exacte, `--text-micro`, `--text-nano` et `--text-code`, et le rendu ne bouge pas d'un pixel.

Enfin, trente-quatre boutons écrits à la main passent au bouton partagé, ce qui leur donne l'état d'attente, le voile et `aria-busy` qu'ils n'avaient pas, et `buttonStyles.ts` disparaît avec son dernier usage. Deux constantes locales nommées `buttonClass` masquaient le nom de la brique commune : elles s'en vont aussi. Les éditeurs en ligne du dictionnaire et du mappage des types restent des champs compacts, parce qu'ils vivent dans des tableaux denses où un champ de formulaire imposerait sa hauteur.

**Le cadrage du MPD.** La vue s'ouvrait mal cadrée, les tables minuscules dans un coin. La cause tient au montage : la vue reste montée quand elle est inactive, simplement masquée, pour que son zoom et ses tables déplacées survivent aux allers et retours. Son canvas naissait donc dans un conteneur de taille nulle. **React Flow ne laisse pas passer le zéro, il lui substitue une taille d'office de 500 sur 500**, donc le cadrage automatique s'exécutait pour une fenêtre qui n'existait pas, et ce cadrage faux restait en place une fois la vue affichée.

Le MCD échappait au piège sans rien de spécial : c'est la vue ouverte au départ, son canvas naît mesurable. La correction rend cette situation au MPD plutôt que de lui ajouter une mécanique qu'il serait seul à porter : **le canvas n'est monté qu'au premier affichage de la vue**, puis il y reste. Avant ce premier affichage il n'y a rien à conserver, personne n'a encore rien déplacé. Après, le cadrage automatique ne s'exécute plus jamais, donc il n'écrase ni le zoom ni les positions.

Un essai de bout en bout mesure ce qu'on voit vraiment : l'échelle du viewport, les boîtes des tables, leur centrage dans la zone. Sans le correctif il tombe à six échecs, les tables rendues à 103 pixels de large au lieu de 185.

**La vérification d'email.** Le serveur faisait déjà tout : il envoie le lien signé, il le valide, et il renvoie la personne vers l'application avec son verdict dans le paramètre `verification`. Côté application, rien ne le recevait. Suivre le lien tombait sur l'accueil **sans un mot**, et un compte dont le lien avait expiré n'avait aucun moyen d'en demander un autre.

La page de retour annonce les quatre verdicts du serveur, `success`, `already`, `expired` et `invalid`, chacun avec son ton. **Elle ne demande jamais de compte** : un lien de courrier s'ouvre souvent depuis un autre appareil que celui où la session est ouverte. Les deux réussites offrent d'entrer dans l'application. Les deux échecs proposent le renvoi quand la session est ouverte, et sinon mènent à la connexion en disant où relancer l'envoi. Rien n'alarme : un lien périmé est une banalité.

Elle se reconnaît à deux signes, le chemin de retour **ou** le seul paramètre. C'est volontaire : l'application se construit en chemins relatifs et peut vivre dans un sous-dossier, où un chemin réel demanderait à l'hébergeur de renvoyer les adresses inconnues vers `index.html`. Avec le paramètre seul, `FRONTEND_EMAIL_VERIFIED_PATH` peut viser la racine et le lien marche quand même. Un verdict inventé dans l'adresse se traite comme un lien illisible : rien de ce qui arrive par l'URL n'est digne de confiance. Et continuer efface le verdict de la barre d'adresse, car il ne vaut qu'une fois.

Le renvoi est une brique unique, posée à trois endroits : la page de retour, le profil et le mode prof. Le serveur distingue ses deux réussites **par le statut**, 202 quand le courrier part et 200 quand l'adresse était déjà confirmée, donc c'est le statut qu'on lit, pas le texte. Son message s'affiche tel quel, y compris le refus pour quota atteint, avec le délai qu'il donne. Quand il répond « déjà vérifié », l'application relit le compte : l'écran cesse aussitôt de réclamer une vérification faite ailleurs.

Le profil montre l'adresse de connexion et son état, **porté par un mot autant que par la pastille**. Le mode prof, lui, demande désormais deux choses, une adresse scolaire et une adresse confirmée. Une adresse scolaire non confirmée ne voit plus le bouton d'activation, qui mènerait à un refus prévisible, mais le renvoi du lien. La règle reste au serveur : l'application lit `email_verified_at` et n'en recalcule rien.

Au passage, la coquille des écrans hors connexion, logo, thème, taille d'interface et carte centrée, que `AuthPage` écrivait pour elle seule, devient une brique partagée avec la page de retour.

**Emporter ses données, et fermer son compte.** Le serveur servait déjà les deux droits, l'export en JSON et la suppression vérifiée par mot de passe. L'application ne les appelait pas : on ne pouvait ni emporter ses données ni partir.

La section **Mes données** du profil télécharge le fichier par le même chemin que les autres exports du logiciel, donc la personne choisit où le déposer. Un mot dit ce qu'il contient, et surtout ce qu'il ne contient pas : les fichiers envoyés y figurent par leur adresse, pas par leur contenu.

La suppression demande **deux gestes de nature différente** : le mot de passe courant, que le serveur exige et vérifie avant d'effacer quoi que ce soit, et une case à cocher. Le bouton rouge reste inerte tant que les deux manquent. Le dialogue dit les conséquences en trois temps, sans détour : ce qui disparaît, ce qui reste sans le nom sous « Compte supprimé », parce qu'un rendu noté et un commentaire appartiennent aussi aux autres, et, **pour un prof seulement**, que ses classes, devoirs et cours partent avec lui et que ses élèves en perdent l'accès.

Le nettoyage local demandait plus qu'une déconnexion. Une déconnexion ordinaire **met de côté** le travail non envoyé dans la boîte d'envoi du compte, qui survit au vidage du cache, pour la prochaine visite. Un compte supprimé n'a pas de prochaine visite : le contrôleur reçoit un chemin à lui, qui vide le cache **sans rien mettre de côté**, et les trois clés que le compte laisse dans ce navigateur, sa boîte d'envoi, ses liens de devoir et la trace de ses imports proposés, sont retirées. L'espace local d'avant compte, lui, ne bouge pas : il n'appartient pas au compte. Deux essais tiennent cette frontière, un sur le contrôleur et un sur l'effacement.

Rien n'est touché tant que le serveur n'a pas répondu : un mot de passe faux laisse la session entière, et le refus s'affiche dans le dialogue, qui reste ouvert, le focus revenu au champ.

**Le poids du premier chargement.** Un audit a mesuré le paquet : **915 kilos bruts, 278 compressés, en un seul morceau**. L'éditeur y pesait lourd, et surtout il était le **seul chemin** vers React Flow et Yjs, cent quatorze kilos compressés à lui deux, soit quarante-trois pour cent du total. Or l'accueil, les classes, le travail et le profil n'ouvrent jamais un schéma : un élève qui vient consulter ses devoirs payait tout, d'avance.

L'éditeur arrive maintenant à la demande, au premier document ouvert. **L'entrée passe de 278 à 148 kilos compressés, moins quarante-sept pour cent**, et le reste part dans un morceau d'éditeur de 131 kilos, chargé une fois puis gardé : revenir à l'accueil et rouvrir un document ne retélécharge rien. Pendant le chargement, un disque et une phrase, « Ouverture de l'éditeur ». C'est la phrase qui porte l'information, pas le disque, puisque la règle de mouvement réduit du dépôt fige les animations.

**Un piège a été rencontré, et il valait la mesure.** Déplacer aussi la feuille de style de React Flow dans le morceau de l'éditeur gagnait trois kilos. Mais, servie après `index.css`, elle repassait **devant** la règle qui rend le focus clavier visible dans le schéma, à spécificité égale : l'essai de bout en bout a vu le contour tomber à `outline-style: none`, le manquement WCAG 2.4.7 réparé au lot de finition. La feuille est donc restée au premier chargement, et le commentaire de `main.tsx` dit pourquoi, pour que personne ne refasse le geste.

**La porte d'entrée du code.** `App.tsx` faisait 967 lignes, dont **une fonction de 693 avec vingt-cinq hooks** et onze chemins d'ouverture de document à la file. C'est le premier fichier qu'un contributeur ouvre, et c'était le plus difficile du dépôt. Sous AGPL, un projet est fait pour être repris : cette porte devait s'ouvrir.

Quatre morceaux en sortent, et chacun fait une chose. `editorTarget.ts` tient ce que l'éditeur travaille et tout ce qui s'en déduit, du contexte collaboratif à ce que propose la barre. `useDocumentOpening.ts` tient les onze chemins, du document personnel à la correction à deux, tous bâtis sur le même geste : préparer le document et sa sauvegarde, puis remplacer la session en libérant la précédente. `useLiveObservation.ts` suit un travail d'élève en direct. `useLocalImportOffer.ts` porte l'offre de copier les documents de cet appareil dans le compte.

**Le gain le plus net est ailleurs que dans le compte de lignes.** Les quarante lignes qui décident où revenir en fermant l'éditeur étaient noyées dans une fonction qui faisait aussi l'envoi en attente et la libération. Elles deviennent `returnTarget`, une fonction pure : un rendu ouvert depuis « À corriger » y retourne, un travail depuis « Mon travail » aussi, un document de groupe revient à l'onglet documents de son groupe, un travail observé ou corrigé à deux revient au suivi. **Treize essais neufs tiennent ces portes**, là où rien ne les vérifiait hors des essais de bout en bout.

`App` garde la navigation, l'état d'écran et les branches de rendu : **354 lignes au lieu de 693, neuf hooks au lieu de vingt-cinq**. Aucune ligne de comportement n'a changé, et c'est la suite entière de bout en bout qui le dit, puisque ces chemins ne sont couverts que là.

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
