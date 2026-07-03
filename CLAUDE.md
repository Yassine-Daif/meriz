# CLAUDE.md

Ce fichier est lu par Claude Code au début de chaque session. Il fixe le contexte et les règles du projet. Respecte-le pour tout ce que tu produis.

## Le projet

Nom du projet : Meriz. Paquet npm et dépôt : `meriz`.

On construit une alternative web moderne à AnalyseSI, le vieux logiciel Java de modélisation de bases de données par la méthode Merise. Le nom Meriz vient de Merise.

Objectif : un outil de modélisation clair, beau, ouvert, qui marche partout. D'abord dans le navigateur, plus tard en application native via Tauri.

Public visé : étudiants, professeurs, professionnels et autodidactes. On vise large, donc l'outil doit rester simple pour un débutant tout en restant utile pour un expert.

## Principes directeurs

1. Clarté avant tout. L'interface doit être lisible et calme. Pas de surcharge, pas de jargon non expliqué.
2. Accessible à tous. C'est une exigence forte, pas un détail. Voir la section Accessibilité.
3. Pédagogique. L'outil aide à apprendre la modélisation et le SQL, pas seulement à dessiner.
4. Open source et propre. Code lisible, bien découpé, facile à reprendre par un autre développeur.

## Stack technique

- React avec TypeScript en mode strict
- Vite pour le build et le serveur de dev
- Tailwind CSS pour le style
- React Flow, paquet `@xyflow/react` (version 12), pour la zone de dessin du schéma
- Plus tard : Tauri pour l'application native, et possiblement un backend Laravel

## Architecture

Règle centrale : on sépare le modèle logique de l'affichage.

- Le modèle MCD est la source de vérité unique. C'est une structure de données pure, en TypeScript, sans aucune dépendance à React Flow et sans coordonnées de dessin.
- Les positions des nœuds (x, y) vivent dans une structure de layout séparée, indexée par identifiant.
- React Flow ne fait que rendre ce modèle. On ne stocke jamais la logique métier dans les nœuds React Flow.

Découpage des dossiers :

- `src/model` : types du modèle MCD, validation, transformations. La source de vérité.
- `src/canvas` : zone React Flow, nœuds et liens personnalisés.
- `src/components` : composants d'interface réutilisables.
- `src/lib` : utilitaires génériques.

## Vocabulaire Merise à employer

Utilise toujours ces termes, en français, dans le code et les commentaires.

- Entité : objet du domaine, porte des attributs.
- Attribut : propriété d'une entité ou d'une association.
- Identifiant : un ou plusieurs attributs qui identifient une entité. Peut être composé.
- Association : lien entre entités, peut porter des attributs.
- Patte : connexion entre une association et une entité, porte une cardinalité.
- Cardinalité : couple (min, max). Valeurs valides : (0,1), (1,1), (0,n), (1,n).
- MCD, MLD, MPD : les trois niveaux du modèle. Pour l'instant on ne traite que le MCD.

## Types de données, règle conceptuel et physique

Au niveau MCD, les attributs portent uniquement des types conceptuels abstraits, les sept suivants : texte, entier, decimal, booleen, date, datetime, heure. Le MCD ne connaît jamais les types SQL.

Les types SQL concrets, comme VARCHAR, INT ou TEXT, et leurs tailles, apparaissent seulement au niveau MPD, via un mappage vers la base cible, MySQL, PostgreSQL et autres. Le passage du conceptuel au physique se fait à cette étape, et le mappage reste éditable par attribut. Ne remonte jamais un type SQL dans le modèle conceptuel.

## Dictionnaire central des propriétés

Le dictionnaire est la liste maîtresse des propriétés. Une propriété, un nom et un type conceptuel, est définie une seule fois. Les entités et les associations la référencent au lieu de la redéfinir. Une propriété est placée dans au plus une entité ou une association, c'est la règle d'unicité de Merise. Une propriété peut exister dans le dictionnaire sans être placée. Ne redéfinis jamais une propriété en double.

## Accessibilité (exigence forte)

Vise le niveau WCAG 2.1 AA.

- Tout doit être utilisable au clavier, pas seulement à la souris.
- États de focus visibles partout.
- Contrastes suffisants. La couleur n'est jamais la seule façon de transmettre une information.
- HTML sémantique et libellés ARIA sur les contrôles.
- Tailles de texte lisibles, interface qui s'adapte au tactile et aux tablettes.

## Conventions de code

- TypeScript strict. Pas de `any`.
- Composants fonctionnels, exports nommés.
- Composants courts, une responsabilité par composant.
- Noms explicites en anglais pour le code, commentaires en français quand ils aident à comprendre une règle Merise.

## Méthode de travail

- Utilise le Plan mode pour toute tâche qui touche plusieurs fichiers.
- Ne devine pas en silence. Si une règle est ambiguë, écris ton hypothèse en une ligne avant de coder.
- Reste dans le périmètre de la tâche demandée. N'ajoute pas de fonctionnalité non demandée.

## Style de la documentation

Pour le README, les commentaires longs et toute doc destinée aux utilisateurs : français clair et direct. Pas de longs tirets, pas de points-virgules décoratifs, pas de formules creuses. Phrases courtes. Voix active.

## Hors périmètre pour l'instant

- Pas de génération MLD, MPD ni SQL tant que le modèle et le canvas ne sont pas solides.
- Pas d'héritage ni de spécialisation Merise dans le MVP. Ce sera une extension de phase 2.