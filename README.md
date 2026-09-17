# Meriz

Meriz est un outil libre de modélisation de bases de données par la méthode Merise. C'est une alternative moderne à AnalyseSI.

Vous dessinez le modèle conceptuel (MCD). Meriz le vérifie, puis en tire le modèle logique (MLD), le modèle physique (MPD) et le script SQL. L'outil fonctionne dans le navigateur ou en logiciel installé, sous Windows, macOS et Linux.

## Essayer

- Version web : https://meriz.mmi25b06.mmi-troyes.fr/app/
- Logiciel à installer : https://meriz.mmi25b06.mmi-troyes.fr/telecharger.html

## Ce que fait Meriz

- **Documents.** Plusieurs documents nommés, à créer, ouvrir, renommer, dupliquer et supprimer depuis l'accueil. Sans compte, ils vivent dans ce navigateur. Connecté, ils vivent dans votre compte et vous suivent d'un appareil à l'autre.
- **Dictionnaire des propriétés.** Chaque donnée est définie une seule fois, puis placée dans une entité ou une association.
- **Éditeur de MCD.** Entités, associations, pattes et cardinalités, à la souris comme au clavier.
- **Vérification.** Les erreurs bloquantes et les avertissements s'affichent en direct. Un clic mène à l'élément concerné.
- **MLD, MPD et SQL.** Ils suivent le MCD en direct, selon les règles de passage Merise. Le script SQL cible MySQL ou PostgreSQL, et les types restent modifiables colonne par colonne.
- **Apprendre.** Une page explique la méthode, les cardinalités et le passage au SQL.
- **Fichiers.** Export et import au format `.meriz.json`, nom du document compris, et export du schéma en PNG.
- **Compte, en option.** Inscription, connexion et déconnexion depuis l'accueil. Meriz marche aussi bien sans compte.

Pour démarrer, le bouton « Découvrir avec l'exemple » de l'accueil ouvre le modèle Client passe Commande. Un modèle plus complet est fourni dans [examples/universite.meriz.json](examples/universite.meriz.json) : importez-le avec « Ouvrir un fichier ».

## Lancer le projet

Prérequis : Node.js 22 ou plus récent, et npm 11.

```bash
npm install        # installe les dépendances
npm run dev        # serveur de développement sur http://localhost:5173
npm run build      # vérifie les types puis construit le site dans dist/
npm run preview    # sert le build de production
npm run lint       # analyse le code avec oxlint
npm test           # lance les tests avec Vitest
```

## Comptes et serveur

Les comptes passent par [Meriz API](https://github.com/Yassine-Daif/meriz-api), un serveur Laravel séparé. L'application lui parle par un jeton, avec une adresse réglée par la variable `VITE_API_URL` : l'origine du serveur, sans `/api`.

- En développement, `.env.development` pointe vers `http://127.0.0.1:8000`. Lancez le serveur avec `php artisan serve` dans son dépôt.
- Pour un build en ligne, créez `.env.production.local` avec l'adresse réelle. Voir `.env.example`.
- Sans adresse, les comptes sont désactivés et l'accueil affiche « Comptes indisponibles ». Tout le reste fonctionne.

Tous les appels réseau passent par `src/lib/apiClient.ts`.

Une fois connecté, le compte fait foi pour les documents. Le navigateur n'en garde qu'un cache de travail, pour aller vite et tenir une courte coupure réseau.

- Hors ligne, vos modifications sont gardées sur l'appareil et envoyées dès le retour du serveur.
- À chaque connexion et à chaque déconnexion, ce cache est vidé puis rechargé : les documents d'un compte n'apparaissent jamais sous un autre.
- Les modifications pas encore envoyées au moment d'une déconnexion sont mises de côté pour ce compte, et reprises à sa prochaine connexion.
- À votre première connexion, Meriz propose une fois de copier dans le compte les documents créés sur cet appareil. Les originaux locaux ne sont jamais supprimés.

## Application de bureau

Le logiciel utilise Tauri. Il faut en plus Rust et les dépendances système décrites dans la [documentation Tauri](https://v2.tauri.app/start/prerequisites/).

```bash
npm run tauri dev      # lance le logiciel en développement
npm run tauri build    # produit les installateurs de votre système
```

Les installateurs des trois systèmes sont construits par GitHub Actions à chaque tag `v*`, puis publiés dans les releases du dépôt.

## Structure

```
src/model        le modèle MCD, sa validation et les transformations MLD, MPD et SQL
src/canvas       la zone de dessin React Flow, ses nœuds et ses liens
src/components   les vues et composants de l'interface
src/lib          les utilitaires : fichiers, stockage, export d'image, accès au serveur
site/            le site vitrine, en HTML et CSS sans dépendance
src-tauri/       le logiciel de bureau
examples/        des modèles d'exemple
deploy/          des modèles de configuration serveur (Apache, nginx)
```

Une règle guide le code : le modèle MCD est la seule source de vérité. C'est une structure de données pure, sans lien avec l'affichage. Les positions du dessin vivent à part, et React Flow ne fait que rendre le modèle. Les tests couvrent les règles de passage dans `src/model`.

## Licence

Meriz est distribué sous licence MIT. Voir le fichier [LICENSE](LICENSE).
