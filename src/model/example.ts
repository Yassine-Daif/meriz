import type { Mcd } from './mcd'
import type { McdLayout } from './layout'

/**
 * Exemple minimal valide : Client passe Commande.
 * Le dictionnaire central définit chaque propriété une seule fois ;
 * les entités les référencent et marquent leurs identifiants.
 *
 * La cardinalité se lit depuis l'entité, vers l'association.
 * Côté Client (0,n) : un client passe zéro ou plusieurs commandes.
 * Côté Commande (1,1) : une commande est passée par exactement un client.
 *
 * `satisfies Mcd` garantit à la compilation que l'exemple respecte
 * les types du modèle. Sa sérialisation JSON sert d'exemple de
 * référence dans la documentation.
 */
export const exampleMcd = {
  properties: [
    { id: 'prop-num-client', name: 'numeroClient', type: 'entier' },
    { id: 'prop-nom-client', name: 'nom', type: 'texte' },
    { id: 'prop-num-commande', name: 'numeroCommande', type: 'entier' },
    { id: 'prop-date-commande', name: 'dateCommande', type: 'date' },
  ],
  entities: [
    {
      id: 'ent-client',
      name: 'Client',
      attributes: [
        { propertyId: 'prop-num-client', isIdentifier: true },
        { propertyId: 'prop-nom-client', isIdentifier: false },
      ],
    },
    {
      id: 'ent-commande',
      name: 'Commande',
      attributes: [
        { propertyId: 'prop-num-commande', isIdentifier: true },
        { propertyId: 'prop-date-commande', isIdentifier: false },
      ],
    },
  ],
  associations: [
    {
      id: 'asso-passer',
      name: 'passer',
      attributes: [],
      legs: [
        {
          id: 'leg-passer-client',
          entityId: 'ent-client',
          cardinality: { min: 0, max: 'n' },
        },
        {
          id: 'leg-passer-commande',
          entityId: 'ent-commande',
          cardinality: { min: 1, max: 1 },
        },
      ],
    },
  ],
} satisfies Mcd

/**
 * Positions initiales des nœuds de l'exemple. Le layout est séparé
 * du modèle (voir layout.ts) : l'exemple reste pur, ses positions
 * vivent ici, indexées par identifiant.
 */
export const exampleLayout: McdLayout = {
  'ent-client': { x: 0, y: 60 },
  'asso-passer': { x: 300, y: 100 },
  'ent-commande': { x: 520, y: 60 },
}
