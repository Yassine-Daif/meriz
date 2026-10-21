# Meriz

Meriz est un outil libre de modélisation de bases de données par la méthode Merise. C'est une alternative moderne à AnalyseSI, pour apprendre, enseigner et concevoir une base de données.

Vous dessinez le modèle conceptuel (MCD). Meriz le vérifie, puis en tire le modèle logique (MLD), le modèle physique (MPD), le SQL et du code Laravel ou Symfony. L'outil fonctionne dans le navigateur ou en logiciel installé, sous Windows, macOS et Linux. Un compte permet aussi de travailler en groupe et d'utiliser les classes, les cours et les devoirs.

## Essayer

- Site Internet : https://meriz.fr/
- Version web : https://app.meriz.fr/
- Logiciel à installer : https://meriz.fr/telecharger.html

L’application et le site sont disponibles en français et en anglais ([site anglais](https://meriz.fr/en/)). La langue se choisit dans « Préférences » et reste mémorisée sur l’appareil, sans modifier les documents. Voir [la documentation des langues](docs/langues.md).

## Modéliser, vérifier et générer

- **Dictionnaire des propriétés.** Chaque donnée est définie une seule fois, avec son type conceptuel, puis placée dans une entité ou une association. Les types SQL restent au niveau physique.
- **Éditeur de MCD.** Entités, associations, attributs, identifiants, pattes et cardinalités. Déplacement et sélection des éléments, annulation et rétablissement, commandes à la souris et au clavier.
- **Vérification.** Les erreurs bloquantes et les avertissements s'affichent en direct. Un clic mène à l'élément concerné.
- **MLD, MPD et SQL.** Ils suivent le MCD selon les règles de passage Merise. Le script SQL cible MySQL ou PostgreSQL, et les types restent modifiables colonne par colonne dans le MPD.
- **Code Laravel.** Génération des migrations et des modèles Eloquent, avec leurs relations. Les tables pivot simples sont prises en charge par les relations entre modèles.
- **Code Symfony.** Génération des entités Doctrine et d'une migration pour le schéma, selon le dialecte SQL choisi.
- **Copie et export du code.** Chaque fichier généré indique son chemin de destination et peut être copié séparément. L'ensemble peut être copié ou exporté dans un fichier Markdown.
- **Apprendre.** Une vue explique la méthode, les cardinalités et le passage au SQL.

Le code généré pose la couche de données, pas une application complète. Il reste à le relire et à écrire les règles de gestion, la validation et les tests. Les limites sont indiquées dans la vue Code, notamment les relations Eloquent à clés composées à compléter à la main et le nom daté de la migration Doctrine à adapter au projet.

Pour démarrer, le bouton « Découvrir avec l'exemple » ouvre le modèle Client passe Commande. Un modèle plus complet est fourni dans [examples/universite.meriz.json](examples/universite.meriz.json) : importez-le avec « Ouvrir un fichier ».

## Documents, compte et confort

- **Documents nommés.** Plusieurs documents à créer, ouvrir, renommer, dupliquer et supprimer depuis l'accueil. Sans compte, ils sont enregistrés sur cet appareil. Connecté, vos documents personnels sont synchronisés avec votre compte.
- **Fichiers.** Import et export au format `.meriz.json`, nom du document compris, et export du MCD en PNG.
- **Compte optionnel.** Inscription, connexion et déconnexion. La modélisation et la génération restent utilisables sans compte. Les classes, les groupes et le partage passent par le serveur.
- **Accès au compte.** Vérification de l'adresse email, renvoi du lien de vérification et réinitialisation d'un mot de passe oublié par email.
- **Profil.** Prénom, nom, pastille personnalisée, présentation et contact. La présentation et le contact se partagent au choix avec les classes. L'email de connexion reste privé.
- **Mes données.** Export des données du compte en JSON et suppression définitive du compte après confirmation du mot de passe. Les médias envoyés figurent dans l'export par leur adresse de téléchargement, pas par une copie des fichiers.
- **Thème et confort.** Thème clair, sombre ou celui du système, taille de l'interface réglable, navigation au clavier et focus visible. Les préférences regroupent la langue, le thème, la taille et l’activation des animations. Le choix est mémorisé sur l'appareil et respecte la réduction des mouvements du système.

## Enseigner et apprendre en classe

- **Accueil selon le rôle.** Documents récents, classes et travail à faire pour l'élève, rendus à corriger pour le prof. L'élève retrouve aussi ses devoirs dans « Mon travail », toutes classes confondues.
- **Classes.** Un élève rejoint une classe avec le code donné par son prof et retrouve ses camarades. Un prof crée ses classes, partage leur code et gère les membres. L'activation du mode prof depuis le profil demande une adresse scolaire ou universitaire reconnue par le serveur **et un email vérifié**.
- **Devoirs.** Le prof prépare un exercice ou un examen avec un énoncé, une image éventuelle, une date limite facultative, un modèle de base et un corrigé. Il publie le devoir et choisit quand rendre le corrigé accessible aux élèves.
- **Travail et rendus.** L'élève commence depuis la base du devoir, ou un modèle vide, puis dépose son rendu. Il peut le remettre à jour tant qu'il n'est pas noté. Le prof consulte le rendu, attribue une note et une appréciation. Un rendu noté est verrouillé, et retirer la note le rouvre.
- **Aide à la correction automatique.** Le rendu est comparé au corrigé : entités, associations et attributs retrouvés, manquants ou supplémentaires, différences de types, d'identifiants et de cardinalités. Meriz propose une note indicative sur 20, que le prof peut reprendre ou modifier. La comparaison relève des points à vérifier, elle ne remplace pas le jugement du prof.
- **Commentaires.** Un fil lié au document de travail permet d'échanger avec l'élève. Un commentaire peut être général ou posé en bulle sur le schéma. Chaque discussion accepte des réponses et peut être marquée résolue ou rouverte. Une nouvelle réponse rouvre la discussion. Le raccourci C prépare la pose d’un commentaire. Les documents de groupe ont aussi leur fil de commentaires.
- **Cours en blocs.** Le prof compose et réordonne des titres, du texte, des liens, des images, des vidéos et des pistes audio, puis publie le cours pour sa classe. L'audio peut être envoyé ou enregistré au microphone. Les vidéos reconnues sont intégrées depuis YouTube, Vimeo ou Dailymotion, les autres adresses restent des liens.

## Suivi en direct et travail en groupe

- **Observation du travail.** Quand le prof active le suivi d'un devoir, il peut voir le travail de l'élève avancer en lecture seule. Il ne publie alors ni présence ni curseur et ne peut pas modifier le modèle. L'élève garde un indicateur du suivi et une trace de la dernière consultation.
- **Correction à deux.** Avec « Corriger en direct », le prof rejoint la co-édition. Sa présence est alors visible, avec la bannière et son curseur. Le crayon rouge permet de montrer une zone du schéma pendant la séance. Le trait apparaît aussi chez son auteur. Sa durée est réglable : 3 secondes, 15 secondes ou conservation sur le serveur, séparément du modèle Merise. Chaque participant peut masquer les annotations sur son écran. Les traits conservés peuvent être effacés par leur auteur ou le responsable du travail, après confirmation.
- **Co-édition en temps réel.** Les modifications du modèle et du dessin sont échangées et fusionnées avec Yjs. Chaque participant voit les autres, leur vue courante, leurs curseurs, les éléments sélectionnés et le rectangle de sélection en cours. Le tracé d'une liaison est aussi partagé pendant sa création.
- **Groupes de travail.** Des élèves peuvent créer un groupe et inviter leurs partenaires par code ou lien. Les membres partagent des documents et les modifient ensemble. Les groupes disposent aussi du crayon et des discussions avec repères et réponses. Le créateur gère le groupe et ses membres. Les participants restent visibles entre eux, contrairement au prof en observation seule.

Le direct utilise Laravel Echo et Reverb. Sans connexion au direct, la co-édition est interrompue et l'interface le signale. L'observation en lecture seule dispose aussi d'un rafraîchissement périodique de secours.

## Lancer le projet

L'application utilise React et TypeScript, Vite pour la construction, Tailwind CSS pour les styles et React Flow pour le dessin.

Prérequis : Node.js 22 (22.12 minimum) ou 24, avec npm. GitHub Actions utilise Node.js 22 et installe les dépendances avec `npm ci`.

```bash
npm ci             # installe les versions du fichier de verrouillage
npm run dev        # serveur de développement sur http://localhost:5173
npm run build      # vérifie les types puis construit l'application dans dist/
npm run preview    # sert le build de production
npm run lint       # analyse le code avec oxlint
npm test           # lance les tests avec Vitest
npm run test:release # vérifie les règles de versionnage
```

L'éditeur local et la génération ne demandent pas de serveur Laravel. Pour les comptes, les classes, les groupes et le direct, configurez aussi Meriz API.

## Comptes et serveur

Les fonctions partagées passent par [Meriz API](https://github.com/Yassine-Daif/meriz-api), un serveur Laravel séparé. L'application s'authentifie par jeton Bearer. `VITE_API_URL` contient l'origine du serveur, sans `/api` ni barre finale.

- En développement, `.env.development` pointe vers `http://127.0.0.1:8000`. Lancez `php artisan serve` dans le dépôt de l'API. Les réglages du direct de ce fichier doivent correspondre à ceux de votre Reverb local.
- Pour remplacer les réglages de développement sans les commiter, utilisez `.env.development.local`.
- Pour une compilation destinée à votre serveur, créez `.env.production.local`, à partir des variables de [.env.example](.env.example). Ces valeurs sont intégrées au build, il faut reconstruire après une modification.
- Sans `VITE_API_URL`, les comptes sont désactivés et l'accueil affiche « Comptes indisponibles ». Les documents locaux, la modélisation et la génération restent utilisables.

Exemple de configuration du build, à adapter à votre serveur et à sa clé Reverb publique :

```ini
VITE_API_URL=https://api.meriz.fr
VITE_REVERB_APP_KEY=cle-publique-de-votre-application-reverb
VITE_REVERB_HOST=api.meriz.fr
VITE_REVERB_PORT=443
VITE_REVERB_SCHEME=https
```

La clé Reverb du client est publique. N'ajoutez jamais de secret serveur dans une variable `VITE_*`. Pour le direct local, lancez aussi `php artisan reverb:start` dans le dépôt de l'API, avec une clé correspondante, l'hôte `127.0.0.1`, le port `8080` et le schéma `http`. Sans configuration Reverb, la co-édition n'est pas disponible et l'observation garde son rafraîchissement périodique.

Les appels HTTP à l'API passent par `src/lib/apiClient.ts`. Les canaux websocket sont autorisés par le serveur pour chaque document.

Une fois connecté, le compte fait foi pour les documents. Le navigateur en garde un cache de travail pour aller vite et supporter une coupure réseau.

- Hors ligne, les modifications des documents personnels sont gardées sur l'appareil et envoyées dès le retour du serveur.
- À chaque connexion et déconnexion, le cache du compte est vidé. Les documents d'un compte n'apparaissent pas sous un autre.
- Les modifications pas encore envoyées au moment d'une déconnexion sont mises de côté pour ce compte et reprises à sa prochaine connexion.
- À la première connexion, Meriz propose une fois de copier dans le compte les documents créés sur l'appareil. Les originaux locaux sont conservés.

Le dépôt de l'API fournit également une zone d'administration Filament sur `/admin`, réservée aux administrateurs. Elle permet de consulter les chiffres de la plateforme et de gérer ses données. Elle est distincte de l'application React et du rôle prof.

## Design

Les couleurs de l'interface sont définies par des tokens dans `src/index.css`, en clair et en sombre. Le test [src/design/contrast.test.ts](src/design/contrast.test.ts) vérifie les couples texte/fond et les contours définis dans sa table de contrastes. Les couleurs personnalisées des pastilles ont leur propre contrôle de lisibilité.

- Les composants de base (boutons, cartes, pastilles, messages) sont dans `src/components/ui`.
- La police Outfit est fournie avec le projet, sous licence OFL. Elle fonctionne hors ligne.
- Les effets sont courts, sans animation permanente de décoration. Ils peuvent être désactivés et suivent la préférence système de réduction des mouvements.
- Les sources du logo et leurs outils sont dans `design/logo`. L'interface utilise le logo en SVG dans `src/components/ui/Lockup.tsx`. Les favicons et l'icône Apple sont publiés dans `public/`, et les icônes du logiciel sont dans `src-tauri/icons/`.

## Application de bureau

Le logiciel utilise Tauri 2 et partage le code React de la version web. Il faut en plus Rust et les dépendances système de Tauri. Le lien vers les prérequis est dans la [documentation Tauri](https://v2.tauri.app/start/prerequisites/).

```bash
npm run tauri dev      # lance le logiciel en développement
npm run tauri build    # produit les installateurs de votre système
```

La configuration active aussi la production des paquets de mise à jour. Leur compilation demande les variables de signature Tauri décrites dans [deploy/MISES-A-JOUR.md](deploy/MISES-A-JOUR.md). Les clés privées restent hors du dépôt.

La modélisation locale fonctionne hors ligne. Les comptes, les classes et la collaboration demandent une connexion au serveur.

Les modifications de l'application poussées sur `main`, ainsi que les tags `v*`, déclenchent le workflow de release. Il vérifie le code, aligne les numéros de version, construit Windows, macOS Intel, macOS Apple Silicon et Linux, puis publie les paquets et le manifeste de mise à jour. Le même commit est ensuite déployé sur le web. Une modification du README seul ne déclenche pas ces compilations.

Les versions récentes du logiciel vérifient les mises à jour au démarrage et pendant l'utilisation. Un bouton permet aussi de les rechercher. Lorsqu'une mise à jour est détectée en cours d'édition, l'application demande son installation et vérifie d'abord la sauvegarde du travail. Les paquets de mise à jour sont signés et leur signature est vérifiée par Tauri. Les installations 1.0.x demandent une première mise à niveau manuelle pour bénéficier de ce mécanisme.

Voir [deploy/MISES-A-JOUR.md](deploy/MISES-A-JOUR.md) pour la publication et les clés de signature, et [deploy/DEPLOIEMENT.md](deploy/DEPLOIEMENT.md) pour l'hébergement.

## Structure

```text
src/model        modèle MCD, validation, MLD, MPD, SQL, génération de code,
                 comparaison des modèles et synchronisation Yjs
src/canvas       dessin React Flow, nœuds, liens, commentaires et présence
src/components   vues et composants, dont ui/, assignments/, lessons/ et groups/
src/design       test de contraste des couleurs
src/lib          fichiers, stockage, API, transport du direct, thème et mises à jour
design/logo      sources du logo et outils de génération
site/            site vitrine en HTML, CSS et JavaScript, sans framework
src-tauri/       application de bureau, configuration et icônes
examples/        modèles d'exemple
deploy/          configurations serveur et réceptionnaire de déploiement
scripts/         gestion et vérification des numéros de version
.github/workflows/ compilation, publication et déploiement automatisés
```

Une règle guide le code : le modèle MCD est la source de vérité pour la modélisation. C'est une structure de données pure, sans dépendance à React Flow. Les positions du dessin vivent à part. Les tests couvrent notamment les règles Merise, la génération de code, la comparaison des modèles, la synchronisation et les échanges avec l'API.

## Licence

Meriz est un logiciel libre sous licence [GNU AGPL 3.0 uniquement](LICENSE), comme indiqué dans `package.json`. Le fichier `LICENSE` contient les conditions de copie, de modification, de distribution et d'accès au code source par le réseau.

Copyright © 2026 Yassine Daif. Les dépendances gardent leur propre licence, notamment MIT pour React et Vite, et OFL pour la police Outfit.
