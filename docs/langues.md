# Français et anglais

La langue se choisit dans Préférences, depuis la barre supérieure. Le choix
reste sur cet appareil et se partage entre ses fenêtres. À la première visite,
le français est proposé aux navigateurs francophones, l’anglais aux autres.
Un lien comportant `?lang=fr` ou `?lang=en` prend la priorité.

Le changement est immédiat, sans rechargement ni reconnexion du direct.
Il ne traduit jamais les documents existants, les commentaires, les noms
saisis ou les identifiants du modèle. Les formats de fichiers et les valeurs
internes restent identiques. Seuls les nouveaux exemples fournis par Meriz
prennent la langue choisie. Les commentaires du code généré sont traduits,
son schéma et ses noms restent ceux du modèle.

La vitrine anglaise utilise cinq pages statiques sous `/en/`, avec leurs
adresses canoniques et leurs liens de langue. Elle fonctionne sans JavaScript.
Les emails système et les messages de l’API suivent la langue de la requête.
Le panneau d’administration technique conserve sa configuration indépendante.

## Maintenir les traductions

Les textes français servent de clés dans `src/i18n`. Utiliser `t` pour les
textes simples et `Translated` pour les phrases contenant des éléments React.
Traduire une phrase entière, avec des paramètres numérotés pour les données.
Ne pas assembler des fragments dont l’ordre grammatical dépend de la langue.
Les paramètres restent du texte React, jamais du HTML injecté.

Le glossaire distingue entity, relationship, attribute, identifier et
cardinality. MCD, MLD et MPD restent les acronymes Merise, accompagnés de
leur explication anglaise. Les types conceptuels sont traduits à l’affichage,
pas dans les fichiers. Une nouvelle traduction doit conserver les paramètres,
les noms propres et les valeurs du modèle.

Les tests couvrent le catalogue, les pluriels, les paramètres, les exemples,
la stabilité des générations et les liens/metadata de la vitrine. Avant une
publication, vérifier aussi le changement de langue pendant une collaboration,
les deux thèmes et les écrans étroits.
