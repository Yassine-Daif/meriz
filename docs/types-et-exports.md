# Dictionnaire, types SQL et exports

Le dictionnaire présente les propriétés dans un tableau compact, avec trois onglets : Tables, Associations et Non affectées. Les tables correspondent aux entités du MCD. L’onglet Associations contient seulement les propriétés portées par les associations. Les associations sans propriété et les liaisons restent dans le MCD. L’ordre du modèle est conservé par défaut ; la recherche et le tri alphabétique restent disponibles. Chaque groupe peut être replié.

La poignée déplace une propriété dans un groupe ou avant une autre propriété. Le sélecteur « Déplacer vers… » permet aussi le déplacement au clavier et sur écran tactile. La propriété conserve son identifiant, son nom et ses paramètres SQL. Elle n’est ni supprimée ni recréée. Déplacer un identifiant demande confirmation ; vers une association ou les propriétés non affectées, il perd son rôle d’identifiant. Vérifier ensuite les clés du modèle.

Les déplacements, l’ordre et les réglages physiques passent par le document Yjs existant. L’annulation reste locale : elle ne doit pas annuler le renommage reçu d’un autre participant. Un déplacement concurrent vers deux groupes est résolu vers un seul porteur.

Le bouton de suppression d’une table ouvre une confirmation. On peut supprimer la table avec ses propriétés, ou garder celles-ci parmi les non affectées. Les pattes vers la table sont retirées. L’action passe par le même historique Yjs : Ctrl+Z restaure la table, les propriétés, leurs paramètres et les liaisons. La lecture seule ne propose aucune suppression.

## Types proposés

Les libellés restent les noms SQL, en français comme en anglais. L’orthographe est VARCHAR, sans trait de soulignement. Les types courants apparaissent avant les types complémentaires.

| Famille | MySQL | PostgreSQL |
|---|---|---|
| Chaînes | VARCHAR, CHAR, TEXT | VARCHAR, CHAR, TEXT |
| Entiers | INT, BIGINT, SMALLINT, TINYINT | INTEGER, BIGINT, SMALLINT |
| Décimaux exacts | DECIMAL | NUMERIC |
| Nombres approchés | FLOAT, DOUBLE | REAL, DOUBLE PRECISION |
| Booléens | BOOLEAN | BOOLEAN |
| Dates et heures | DATE, TIME, DATETIME, TIMESTAMP | DATE, TIME, TIMESTAMP, TIMESTAMP WITH TIME ZONE |
| Documents | JSON | JSON, JSONB |
| Binaire | BLOB, VARBINARY | BYTEA |
| Autres | ENUM | UUID |

Ce catalogue couvre les usages usuels sans exposer toutes les variantes d’un moteur. DECIMAL/NUMERIC conviennent aux montants exacts ; FLOAT/REAL/DOUBLE restent approchés. TEXT évite de choisir une longueur arbitraire pour un texte long ; VARCHAR garde une longueur explicite. JSONB, UUID et ENUM sont propres aux moteurs indiqués.

Les champs de paramètres proposent la longueur, la précision et les décimales, ou les valeurs d’un ENUM. UNSIGNED est disponible pour les entiers MySQL. L’auto-incrément se règle sur un identifiant entier simple. Les paramètres incomplets ne sont pas envoyés au direct. Les limites de stockage restent aussi dépendantes du moteur, de l’encodage et de la largeur totale d’une ligne.

Le MCD conserve ses sept catégories conceptuelles internes. Le choix SQL et ses paramètres sont dans les réglages MPD, indexés par identifiant stable, et enregistrés avec le document. Les clés étrangères héritent du type physique de l’identifiant référencé. Les anciens fichiers restent ouvrables ; une surcharge inconnue ou incompatible n’est pas remplacée sans avertissement.

Changer de moteur adapte les noms correspondants, par exemple INT/INTEGER et DECIMAL/NUMERIC. Cela ne garantit pas l’équivalence de toutes les capacités ou plages de valeurs. Un type sans correspondance, par exemple ENUM vers PostgreSQL ou UUID vers MySQL, demande une décision explicite avant l’export. Les options incompatibles, comme UNSIGNED sous PostgreSQL, bloquent l’export concerné.

## Laravel

L’export contient les migrations et les modèles Eloquent. Les migrations portent les types et paramètres physiques choisis. Les clés étrangères visant une table créée plus tard sont reportées dans une migration finale.

Copier les fichiers dans un projet Laravel configuré pour la bonne base, adapter les dates de migrations pour éviter les collisions, puis utiliser :

    php artisan migrate:status
    php artisan migrate --pretend
    php artisan migrate

Ces commandes vérifient et appliquent les fichiers fournis ; elles ne créent pas une seconde migration pour les mêmes tables. La syntaxe produite a été exécutée avec Laravel 13. Le cas ENUM contenant une apostrophe utilise rawColumn avec le type validé pour conserver la valeur exacte.

## Symfony et Doctrine

Le sélecteur propose deux parcours distincts.

### Entités puis migration Doctrine

Copier seulement les entités dans src/Entity d’un projet équipé de Doctrine ORM, des migrations et de MakerBundle, puis :

    php bin/console doctrine:schema:validate --skip-sync
    php bin/console make:migration
    php bin/console doctrine:migrations:migrate --dry-run
    php bin/console doctrine:migrations:migrate

Doctrine compare les entités à la base configurée. La migration fournie par Meriz est exclue de ce parcours. Lire la migration générée avant de l’appliquer à une base existante.

### Migration fournie par Meriz

Copier les entités et la migration, en choisissant le chemin configuré dans doctrine_migrations.yaml : src/Migrations avec App\Migrations, ou migrations avec DoctrineMigrations. Renommer ensemble la classe et le fichier Version… avec un identifiant libre.

    php bin/console doctrine:migrations:status
    php bin/console doctrine:migrations:migrate --dry-run
    php bin/console doctrine:migrations:migrate

Ne pas lancer make:migration pour générer une seconde création des mêmes tables.

Les exports ont été exécutés avec Symfony 7.4, Doctrine ORM 3 et DBAL 4.3, notamment pour les types ENUM, JSONB et SMALLFLOAT. Deux choix natifs MySQL nécessitent un mappage Doctrine personnalisé : TINYINT est relu comme BOOLEAN, et TIMESTAMP comme DATETIME. Meriz le signale et bloque le parcours automatique pour ces choix, plutôt que de produire des différences répétées. La migration fournie conserve leur SQL natif ; elle ne résout pas à elle seule ce mappage. SQL et Laravel restent disponibles avec ces types.

## Vérifications de la version 1.6.0

- Tests du déplacement, de l’annulation et des modifications concurrentes Yjs, des paramètres, de la persistance et des exports.
- Interface française et anglaise, glisser-déposer natif et petits écrans avec texte agrandi.
- SQL du catalogue exécuté sous MySQL 8.4 et PostgreSQL 17.
- Migrations Laravel exécutées ; génération et application des migrations Doctrine depuis les entités avec schéma synchronisé pour les types compatibles.
- Migrations fournies, chemins Symfony moderne et classique, création puis annulation de références circulaires sur les deux moteurs.

Les commandes sont proposées à copier. Meriz n’accède pas à la base de données d’un projet et ne lance aucune migration à sa place.
