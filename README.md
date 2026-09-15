# Meriz

Meriz est un outil libre de modélisation de bases de données par la méthode Merise. C'est une alternative moderne à AnalyseSI.

Vous dessinez le modèle conceptuel (MCD). Meriz le vérifie, puis en tire le modèle logique (MLD), le modèle physique (MPD) et le script SQL. L'outil fonctionne dans le navigateur ou en logiciel installé, sous Windows, macOS et Linux.

## Essayer

- Version web : https://meriz.mmi25b06.mmi-troyes.fr/app/
- Logiciel à installer : https://meriz.mmi25b06.mmi-troyes.fr/telecharger.html

## Ce que fait Meriz

- **Dictionnaire des propriétés.** Chaque donnée est définie une seule fois, puis placée dans une entité ou une association.
- **Éditeur de MCD.** Entités, associations, pattes et cardinalités, à la souris comme au clavier.
- **Vérification.** Les erreurs bloquantes et les avertissements s'affichent en direct. Un clic mène à l'élément concerné.
- **MLD, MPD et SQL.** Ils suivent le MCD en direct, selon les règles de passage Merise. Le script SQL cible MySQL ou PostgreSQL, et les types restent modifiables colonne par colonne.
- **Apprendre.** Une page explique la méthode, les cardinalités et le passage au SQL.
- **Fichiers.** Enregistrement et ouverture au format `.meriz.json`, export du schéma en PNG, sauvegarde automatique dans le navigateur.

Un modèle complet sert d'exemple : [examples/universite.meriz.json](examples/universite.meriz.json). Ouvrez-le depuis le bouton Ouvrir.

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
src/lib          les utilitaires : fichiers, sauvegarde, export d'image
site/            le site vitrine, en HTML et CSS sans dépendance
src-tauri/       le logiciel de bureau
examples/        des modèles d'exemple
deploy/          des modèles de configuration serveur (Apache, nginx)
```

Une règle guide le code : le modèle MCD est la seule source de vérité. C'est une structure de données pure, sans lien avec l'affichage. Les positions du dessin vivent à part, et React Flow ne fait que rendre le modèle. Les tests couvrent les règles de passage dans `src/model`.

## Licence

Meriz est distribué sous licence MIT. Voir le fichier [LICENSE](LICENSE).
