# Les liens du site vitrine

Ce fichier dit où vivent les adresses du site, et quoi reprendre si
elles changent. Il n'est pas déployé.

## 1. L'application web

Valeur en place : `https://app.meriz.fr`

Dix-sept liens, dans les quatre pages : le bouton de la barre de
navigation et celui du menu des petits écrans sur chaque page, le lien
du pied de page, les deux actions de l'accueil, celui de la fin de la
page Fonctions, celui de la page Merise, et celui de la page
Télécharger.

L'application est servie **à la racine de ce sous-domaine**, sans
préfixe de chemin. Pour les retrouver :

```
grep -rn "app.meriz.fr" site/*.html
```

## 2. Les téléchargements

Deux formes coexistent, et c'est voulu.

**Dans la page servie**, les sept boutons pointent vers
`https://github.com/Yassine-Daif/meriz/releases/latest`. C'est le repli :
il reste valable à chaque publication, et il mène quelque part même si
rien ne s'exécute.

**Au chargement**, `telechargement.js` lit la dernière publication sur
l'API de GitHub et réécrit chaque bouton vers son fichier précis, avec
l'attribut `download` et le poids réel. Le visiteur reçoit donc le
fichier directement, sans passer par la page des versions.

Les binaires portent leur numéro de version dans leur nom, par exemple
`Meriz_1.0.1_x64-setup.exe` : c'est pourquoi l'adresse exacte ne peut
pas être écrite dans la page.

Si l'API ne répond pas, quota atteint ou réseau coupé, les boutons
gardent le repli et la ligne de version reste masquée plutôt que
d'afficher un numéro faux.

## 3. Le numéro de version

Il paraît à trois endroits : le badge de la barre de navigation
(`[data-version-courte]`), la carte de téléchargement
(`[data-version-carte]`) et le pied de page (`[data-version]`). Il est
toujours lu sur la dernière publication, jamais écrit en dur.

Sur la page Télécharger, c'est `telechargement.js` qui les remplit. Sur
les trois autres, c'est la dernière partie de `site.js`. Un seul appel
par page.

## Le domaine

Les balises `canonical`, `og:url` et le `sitemap.xml` portent
`https://meriz.fr/`. À reprendre si le domaine change.

## Où vivent les fichiers en production

| Dossier servi | Contenu | Adresse |
| --- | --- | --- |
| `/var/www/meriz-site` | ce dossier `site/` | `https://meriz.fr` |
| `/var/www/meriz-app` | le `dist/` de l'application | `https://app.meriz.fr` |
| `/var/www/meriz-api` | le serveur Laravel | `https://api.meriz.fr` |

## Déployer à la main

Depuis ce poste, qui n'a pas `rsync` :

```
cd site
tar -czf - --exclude=LIENS.md . | ssh ubuntu@5.135.150.216 \
  "rm -rf ~/meriz-site-neuf && mkdir -p ~/meriz-site-neuf && tar -xzf - -C ~/meriz-site-neuf"
ssh ubuntu@5.135.150.216 \
  "rsync -a --delete --delay-updates --chmod=D755,F644 ~/meriz-site-neuf/ /var/www/meriz-site/"
```

`--delay-updates` bascule les fichiers à la fin : personne ne tombe sur
un site à moitié remplacé.

**Après la bascule**, remettre le groupe, que `rsync` ramène sur
`ubuntu` :

```
ssh ubuntu@5.135.150.216 \
  "sudo chgrp -R www-data /var/www/meriz-site && sudo chmod g+s /var/www/meriz-site"
```

Le site reste servi sans cela, les fichiers étant lisibles par tous,
mais le dossier retrouve ainsi l'état posé à l'installation.
