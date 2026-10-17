# Les liens à finaliser au déploiement

Deux adresses seulement, repérées dans les pages par un commentaire
`LIEN À FINALISER`. Les valeurs posées aujourd'hui sont justes : si on
oublie ce fichier, rien ne casse.

## 1. L'application web

Valeur actuelle : `app/`

C'est déjà la bonne pour le déploiement en place : le workflow
`deploy-web.yml` envoie `site/` à la racine du serveur et `dist/` dans
`app/`. L'application vit donc dans un sous-dossier du même domaine.

À changer seulement si l'application déménage, par exemple sur un
sous-domaine `https://app.meriz.fr/`. Dans ce cas, remplacer les `href="app/"`
dans les quatre pages.

## 2. Les téléchargements

Valeur actuelle : `https://github.com/Yassine-Daif/meriz/releases/latest`

Trois boutons de `telecharger.html` y mènent, un par système. Ce lien
reste valable à chaque publication.

**Pourquoi pas de lien direct vers chaque fichier.** Les binaires portent
leur numéro de version dans leur nom, par exemple
`Meriz_0.1.0_x64-setup.exe`. Un lien direct deviendrait donc faux à la
version suivante, et il faudrait rouvrir le site à chaque sortie. Si un
jour les noms deviennent stables, on pourra pointer
`releases/latest/download/<nom>` directement.

## Pour vérifier avant la mise en ligne

```
grep -rn "LIEN À FINALISER" site/
```

## Le domaine

Les balises `canonical`, `og:url` et le `sitemap.xml` portent
`https://meriz.fr/`. À reprendre si le domaine change.
