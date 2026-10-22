# Vérifier la mise en page du site

La navigation complète reste sur une ligne. Si ses vrais libellés, la police
ou le numéro de version prennent trop de place, elle passe en menu compact.
Le seuil CSS fournit un premier repli ; la mesure dans `site.js` tient aussi
compte des dimensions réelles après chargement de la police et de la version.

Le menu compact doit fonctionner à toute largeur où son bouton apparaît,
y compris entre téléphone et grand écran. Vérifier son ouverture, ses liens,
le changement de thème, Échap et le retour au mode complet.

## Contrôle reproductible

Avec Chromium lancé dans un profil de diagnostic et son port de débogage
9222, exécuter depuis la racine du dépôt :

```sh
node scripts/check-site-layout.mjs --stress
```

Le contrôle sert les fichiers locaux dans le navigateur. Ajouter `--public`
pour vérifier les fichiers réellement servis par meriz.fr. `CDP_ENDPOINT`
permet de choisir une autre adresse de débogage. Ne pas utiliser son profil
personnel pour ces essais.

Le workflow `Site layout` lance le même contrôle sur les changements du site
et conserve le rapport JSON et les captures. Les dix pages sont parcourues,
de 320 à 1920 pixels, aux seuils de changement de disposition, en français
et en anglais. Chaque onglet accessible est ouvert, au lieu de se limiter
au panneau visible au chargement.

Les tailles de police sont réellement multipliées par 1, 1,25 puis 2, après
application des règles de chaque largeur. Modifier seulement la taille de
police racine ne suffit pas : les styles du site utilisent des pixels.

Les contrôles recherchent les liens du header sur plusieurs lignes, les
chevauchements, les icônes écrasées, les libellés hors de leur contrôle, les
débordements et les menus qui ne donnent pas accès aux liens. Compléter
le rapport par une inspection des captures, notamment à 1920, 1280, 821 et
320 pixels et dans les deux thèmes. Les schémas illustratifs et leurs zones
de défilement restent distincts de la prose et des commandes.
