import type { Mcd } from './mcd'
import { exampleMcd } from './example'

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
 * C'est l'exemple de l'application, testé tel qu'il est proposé.
 */
export const clientCommande = exampleMcd

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

/**
 * Un à un : un employé occupe un bureau, un bureau est occupé par au
 * plus un employé. La clé part donc du côté (1,1), dans `Employe`.
 * Porte aussi les deux types que les autres fixtures n'utilisent pas
 * côté entité, le booléen et l'heure.
 */
export const occupation = {
  properties: [
    { id: 'prop-num-employe', name: 'numeroEmploye', type: 'entier' },
    { id: 'prop-est-cadre', name: 'estCadre', type: 'booleen' },
    { id: 'prop-num-bureau', name: 'numeroBureau', type: 'entier' },
    { id: 'prop-heure-ouverture', name: 'heureOuverture', type: 'heure' },
  ],
  entities: [
    {
      id: 'ent-employe',
      name: 'Employe',
      attributes: [
        { propertyId: 'prop-num-employe', isIdentifier: true },
        { propertyId: 'prop-est-cadre', isIdentifier: false },
      ],
    },
    {
      id: 'ent-bureau',
      name: 'Bureau',
      attributes: [
        { propertyId: 'prop-num-bureau', isIdentifier: true },
        { propertyId: 'prop-heure-ouverture', isIdentifier: false },
      ],
    },
  ],
  associations: [
    {
      id: 'asso-occuper',
      name: 'occuper',
      attributes: [],
      legs: [
        { id: 'leg-occuper-employe', entityId: 'ent-employe', cardinality: { min: 1, max: 1 } },
        { id: 'leg-occuper-bureau', entityId: 'ent-bureau', cardinality: { min: 0, max: 1 } },
      ],
    },
  ],
} satisfies Mcd

/**
 * Ternaire et porteuse : un fournisseur livre un produit à un magasin,
 * en quantité et à une date. Trois pattes, donc une table de liaison à
 * clé composée, et jamais un plusieurs à plusieurs.
 */
export const livraisonTernaire = {
  properties: [
    { id: 'prop-num-fournisseur', name: 'numeroFournisseur', type: 'entier' },
    { id: 'prop-ref-produit', name: 'referenceProduit', type: 'texte', size: 20 },
    { id: 'prop-num-magasin', name: 'numeroMagasin', type: 'entier' },
    { id: 'prop-quantite', name: 'quantite', type: 'entier' },
    { id: 'prop-livree-le', name: 'livreeLe', type: 'datetime' },
  ],
  entities: [
    {
      id: 'ent-fournisseur',
      name: 'Fournisseur',
      attributes: [{ propertyId: 'prop-num-fournisseur', isIdentifier: true }],
    },
    {
      id: 'ent-produit',
      name: 'Produit',
      attributes: [{ propertyId: 'prop-ref-produit', isIdentifier: true }],
    },
    {
      id: 'ent-magasin',
      name: 'Magasin',
      attributes: [{ propertyId: 'prop-num-magasin', isIdentifier: true }],
    },
  ],
  associations: [
    {
      id: 'asso-livrer',
      name: 'livrer',
      attributes: [
        { propertyId: 'prop-quantite', isIdentifier: false },
        { propertyId: 'prop-livree-le', isIdentifier: false },
      ],
      legs: [
        { id: 'leg-livrer-fournisseur', entityId: 'ent-fournisseur', cardinality: { min: 0, max: 'n' } },
        { id: 'leg-livrer-produit', entityId: 'ent-produit', cardinality: { min: 0, max: 'n' } },
        { id: 'leg-livrer-magasin', entityId: 'ent-magasin', cardinality: { min: 0, max: 'n' } },
      ],
    },
  ],
} satisfies Mcd

/**
 * Modèle volontairement incomplet : `Note` n'a aucun identifiant. La
 * génération doit tenir debout quand même, puisqu'elle n'est jamais
 * bloquée par les erreurs de validation.
 */
export const entiteSansIdentifiant = {
  properties: [
    { id: 'prop-num-devoir', name: 'numeroDevoir', type: 'entier' },
    { id: 'prop-valeur', name: 'valeur', type: 'decimal' },
  ],
  entities: [
    {
      id: 'ent-devoir',
      name: 'Devoir',
      attributes: [{ propertyId: 'prop-num-devoir', isIdentifier: true }],
    },
    {
      id: 'ent-note',
      name: 'Note',
      attributes: [{ propertyId: 'prop-valeur', isIdentifier: false }],
    },
  ],
  associations: [
    {
      id: 'asso-porter',
      name: 'porter',
      attributes: [],
      legs: [
        { id: 'leg-porter-devoir', entityId: 'ent-devoir', cardinality: { min: 0, max: 'n' } },
        { id: 'leg-porter-note', entityId: 'ent-note', cardinality: { min: 1, max: 1 } },
      ],
    },
  ],
} satisfies Mcd
