import type { Mcd } from './mcd'

/**
 * MCD de référence pour les tests des règles de passage. Écrits à la
 * main, ids lisibles, `satisfies Mcd` garantit à la compilation qu'ils
 * respectent les types du modèle.
 *
 * Rappel : la cardinalité se lit depuis l'entité, vers l'association.
 */

/**
 * Client (0,n) passer Commande (1,1) : un client passe zéro ou
 * plusieurs commandes, une commande est passée par exactement un client.
 */
export const clientCommande = {
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
        { id: 'leg-passer-client', entityId: 'ent-client', cardinality: { min: 0, max: 'n' } },
        { id: 'leg-passer-commande', entityId: 'ent-commande', cardinality: { min: 1, max: 1 } },
      ],
    },
  ],
} satisfies Mcd

/** Même cas, mais une commande peut n'avoir aucun client : Commande (0,1). */
export const clientCommandeOptionnel = {
  ...clientCommande,
  associations: [
    {
      id: 'asso-passer',
      name: 'passer',
      attributes: [],
      legs: [
        { id: 'leg-passer-client', entityId: 'ent-client', cardinality: { min: 0, max: 'n' } },
        { id: 'leg-passer-commande', entityId: 'ent-commande', cardinality: { min: 0, max: 1 } },
      ],
    },
  ],
} satisfies Mcd

/**
 * Etudiant (0,n) inscrire Cours (1,n), association porteuse de la
 * propriété `note` : aucune patte à maximum 1, donc table de jonction.
 */
export const inscription = {
  properties: [
    { id: 'prop-num-etudiant', name: 'numeroEtudiant', type: 'entier' },
    { id: 'prop-code-cours', name: 'codeCours', type: 'texte', size: 10 },
    { id: 'prop-note', name: 'note', type: 'decimal' },
  ],
  entities: [
    {
      id: 'ent-etudiant',
      name: 'Etudiant',
      attributes: [{ propertyId: 'prop-num-etudiant', isIdentifier: true }],
    },
    {
      id: 'ent-cours',
      name: 'Cours',
      attributes: [{ propertyId: 'prop-code-cours', isIdentifier: true }],
    },
  ],
  associations: [
    {
      id: 'asso-inscrire',
      name: 'inscrire',
      attributes: [{ propertyId: 'prop-note', isIdentifier: false }],
      legs: [
        { id: 'leg-inscrire-etudiant', entityId: 'ent-etudiant', cardinality: { min: 0, max: 'n' } },
        { id: 'leg-inscrire-cours', entityId: 'ent-cours', cardinality: { min: 1, max: 'n' } },
      ],
    },
  ],
} satisfies Mcd

/**
 * Association réflexive : un étudiant tuteur (0,n) accompagne des
 * étudiants, un étudiant tutoré (0,1) a au plus un tuteur. Deux pattes
 * vers la même entité, chacune nommée par son rôle.
 */
export const tutorat = {
  properties: [{ id: 'prop-num-etudiant', name: 'numeroEtudiant', type: 'entier' }],
  entities: [
    {
      id: 'ent-etudiant',
      name: 'Etudiant',
      attributes: [{ propertyId: 'prop-num-etudiant', isIdentifier: true }],
    },
  ],
  associations: [
    {
      id: 'asso-tutorer',
      name: 'tutorer',
      attributes: [],
      legs: [
        {
          id: 'leg-tutorer-tuteur',
          entityId: 'ent-etudiant',
          cardinality: { min: 0, max: 'n' },
          role: 'tuteur',
        },
        {
          id: 'leg-tutorer-tutore',
          entityId: 'ent-etudiant',
          cardinality: { min: 0, max: 1 },
          role: 'tutore',
        },
      ],
    },
  ],
} satisfies Mcd

/**
 * Identifiant composé : un vol est identifié par son numéro ET sa date.
 * Reservation (1,1) concerner Vol (0,n) reçoit la clé composée entière ;
 * Passager (0,n) embarquer Vol (0,n) devient une jonction à trois colonnes.
 */
export const vols = {
  properties: [
    { id: 'prop-num-vol', name: 'numeroVol', type: 'texte', size: 8 },
    { id: 'prop-date-vol', name: 'dateVol', type: 'date' },
    { id: 'prop-num-reservation', name: 'numeroReservation', type: 'entier' },
    { id: 'prop-num-passager', name: 'numeroPassager', type: 'entier' },
  ],
  entities: [
    {
      id: 'ent-vol',
      name: 'Vol',
      attributes: [
        { propertyId: 'prop-num-vol', isIdentifier: true },
        { propertyId: 'prop-date-vol', isIdentifier: true },
      ],
    },
    {
      id: 'ent-reservation',
      name: 'Reservation',
      attributes: [{ propertyId: 'prop-num-reservation', isIdentifier: true }],
    },
    {
      id: 'ent-passager',
      name: 'Passager',
      attributes: [{ propertyId: 'prop-num-passager', isIdentifier: true }],
    },
  ],
  associations: [
    {
      id: 'asso-concerner',
      name: 'concerner',
      attributes: [],
      legs: [
        { id: 'leg-concerner-reservation', entityId: 'ent-reservation', cardinality: { min: 1, max: 1 } },
        { id: 'leg-concerner-vol', entityId: 'ent-vol', cardinality: { min: 0, max: 'n' } },
      ],
    },
    {
      id: 'asso-embarquer',
      name: 'embarquer',
      attributes: [],
      legs: [
        { id: 'leg-embarquer-passager', entityId: 'ent-passager', cardinality: { min: 0, max: 'n' } },
        { id: 'leg-embarquer-vol', entityId: 'ent-vol', cardinality: { min: 0, max: 'n' } },
      ],
    },
  ],
} satisfies Mcd
