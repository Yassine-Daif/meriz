# Les liens du site vitrine

Les deux liens qui dépendaient du déploiement sont **finalisés**
(déploiement du 17 octobre 2026). Ce fichier dit où ils sont, et quoi
reprendre s'ils changent un jour.

## 1. L'application web

Valeur en place : `https://app.meriz.fr`

Neuf liens, dans les quatre pages : le bouton de la barre de navigation
de chaque page, les deux actions de l'accueil, celui de la fin de la
page Fonctions, celui de la page Merise, et celui de la page
Télécharger.

L'application est servie **à la racine de ce sous-domaine**, sans
préfixe de chemin. Pour la retrouver :

```
grep -rn "app.meriz.fr" site/*.html
```

## 2. Les téléchargements

Valeur en place : `https://github.com/Yassine-Daif/meriz/releases/latest`

Trois boutons de `telecharger.html`, un par système. Ce lien reste
valable à chaque publication.

**Pourquoi pas de lien direct vers chaque fichier.** Les binaires
portent leur numéro de version dans leur nom, par exemple
`Meriz_0.1.0_x64-setup.exe`. Un lien direct deviendrait faux à la
version suivante. Si un jour les noms deviennent stables, on pourra
pointer `releases/latest/download/<nom>` directement.

## Le domaine

Les balises `canonical`, `og:url` et le `sitemap.xml` portent
`https://meriz.fr/`. À reprendre si le domaine change.

## Où vivent les fichiers en production

| Dossier servi | Contenu | Adresse |
| --- | --- | --- |
| `/var/www/meriz-site` | ce dossier `site/` | `https://meriz.fr` |
| `/var/www/meriz-app` | le `dist/` de l'application | `https://app.meriz.fr` |
| `/var/www/meriz-api` | le serveur Laravel | `https://api.meriz.fr` |
