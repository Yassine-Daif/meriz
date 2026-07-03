# Invariants de validité du MCD

Règles qu'un MCD doit respecter pour être valide. Cette liste sert de spécification à la fonction de validation (`validate.ts`). Les types de `mcd.ts` garantissent la forme des données, ces invariants garantissent leur cohérence.

## Identifiants techniques

1. Tous les `id` du modèle (propriétés, entités, associations, pattes) sont uniques dans le modèle entier.

## Dictionnaire des propriétés

2. Chaque propriété a un nom non vide.
3. Deux propriétés distinctes ne portent pas le même nom : une propriété est définie une seule fois dans le dictionnaire.
4. Une propriété peut exister sans être placée. Ce n'est pas un problème de validité.

## Placements (références)

5. Chaque référence d'attribut pointe vers une propriété existante du dictionnaire.
6. Une propriété est placée dans au plus un porteur (entité ou association), et au plus une fois dans ce porteur. C'est la règle d'unicité de Merise.

## Entités

7. Chaque entité a un nom non vide.
8. Deux entités distinctes n'ont pas le même nom.
9. Chaque entité a au moins un attribut (une référence).
10. Chaque entité a au moins une référence marquée `isIdentifier` (identifiant simple ou composé).

## Associations

11. Chaque association a un nom non vide.
12. Deux associations distinctes n'ont pas le même nom. Une association peut en revanche porter le même nom qu'une entité, les deux familles sont des espaces de noms séparés.
13. Chaque association a au moins deux pattes. Deux pattes pour une binaire, trois ou plus pour une ternaire et au-delà.
14. Aucune référence d'association n'est marquée `isIdentifier` : être identifiant est un rôle réservé aux placements dans une entité.

## Pattes

15. Chaque patte référence l'`id` d'une entité existante du modèle.
16. Si plusieurs pattes d'une même association visent la même entité (association réflexive), chaque patte concernée porte un rôle, et ces rôles sont distincts entre eux.

## Cardinalités

17. Les cardinalités valides sont exactement (0,1), (1,1), (0,n), (1,n). Le type `Cardinality` le garantit à la compilation, et `persistence.ts` le revérifie à l'ouverture d'un fichier.
