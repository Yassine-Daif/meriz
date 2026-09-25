import { describe, expect, it } from 'vitest'
import type { Mcd } from './mcd'
import {
  compareMcd,
  comparisonDetailText,
  comparisonSummaryText,
  formatGrade,
  normalizeName,
} from './compare'
import { clientCommande, clientCommandeOptionnel, inscription, tutorat } from './testFixtures'

const kinds = (mcd: Mcd, reference: Mcd) => compareMcd(mcd, reference).differences.map((d) => d.kind)
const messages = (mcd: Mcd, reference: Mcd) => compareMcd(mcd, reference).differences.map((d) => d.message)

describe('appariement souple des noms', () => {
  it('ignore la casse, les accents, les tirets et les espaces en trop', () => {
    expect(normalizeName('Client')).toBe(normalizeName('  client '))
    expect(normalizeName('Étudiant')).toBe(normalizeName('etudiant'))
    expect(normalizeName('date_vol')).toBe(normalizeName('Date Vol'))
    expect(normalizeName('numero-commande')).toBe(normalizeName('Numero   Commande'))
  })

  it('ne devine pas le pluriel : deux noms distincts restent distincts', () => {
    expect(normalizeName('Client')).not.toBe(normalizeName('Clients'))
  })
})

describe('modèles équivalents', () => {
  it('ne relève rien quand le rendu est le corrigé', () => {
    const comparison = compareMcd(clientCommande, clientCommande)

    expect(comparison.differences).toEqual([])
    expect(comparison.summary.matchedPoints).toBe(comparison.summary.expectedPoints)
    expect(comparison.summary.checks).toBe(0)
    expect(comparison.summary.extras).toBe(0)
  })

  it('fait correspondre le même modèle écrit autrement : autre ordre, autre casse, autres ids', () => {
    // Même contenu que `inscription`, tout réécrit : ids différents, ordre
    // inversé partout, accents et casse changés.
    const autrement = {
      properties: [
        { id: 'p3', name: 'NOTE', type: 'decimal' },
        { id: 'p1', name: 'Code_Cours', type: 'texte', size: 10 },
        { id: 'p2', name: 'NumeroEtudiant', type: 'entier' },
      ],
      entities: [
        { id: 'e2', name: 'cours', attributes: [{ propertyId: 'p1', isIdentifier: true }] },
        { id: 'e1', name: 'Étudiant', attributes: [{ propertyId: 'p2', isIdentifier: true }] },
      ],
      associations: [
        {
          id: 'a1',
          name: 'Inscrire',
          attributes: [{ propertyId: 'p3', isIdentifier: false }],
          legs: [
            { id: 'l2', entityId: 'e2', cardinality: { min: 1, max: 'n' } },
            { id: 'l1', entityId: 'e1', cardinality: { min: 0, max: 'n' } },
          ],
        },
      ],
    } satisfies Mcd

    const comparison = compareMcd(autrement, inscription)

    expect(comparison.differences).toEqual([])
    expect(comparison.matchedEntities).toHaveLength(2)
    expect(comparison.matchedAssociations).toHaveLength(1)
    expect(comparison.summary.suggestedGrade).toBe(20)
  })
})

describe('entités', () => {
  it('signale une entité attendue absente, une seule fois', () => {
    const sansCommande = {
      ...clientCommande,
      entities: clientCommande.entities.filter((entity) => normalizeName(entity.name) !== 'commande'),
      associations: [],
    } satisfies Mcd

    const relevé = compareMcd(sansCommande, clientCommande)

    expect(relevé.differences.filter((d) => d.kind === 'entity-missing')).toHaveLength(1)
    expect(relevé.differences.find((d) => d.kind === 'entity-missing')?.message).toContain('Commande')
    expect(relevé.summary.extras).toBe(0)
  })

  it('signale une entité en trop sans la compter comme manquante', () => {
    const avecFacture = {
      ...clientCommande,
      entities: [...clientCommande.entities, { id: 'ent-facture', name: 'Facture', attributes: [] }],
    } satisfies Mcd

    const relevé = compareMcd(avecFacture, clientCommande)

    expect(relevé.differences.map((d) => d.kind)).toEqual(['entity-extra'])
    expect(relevé.summary.extras).toBe(1)
    expect(relevé.summary.checks).toBe(0)
  })
})

describe('attributs', () => {
  const référence = inscription

  it('signale un attribut absent et un attribut en trop', () => {
    const sansNote = {
      ...référence,
      associations: [{ ...référence.associations[0], attributes: [] }],
    } satisfies Mcd
    const avecEnPlus = {
      properties: [...référence.properties, { id: 'prop-mail', name: 'email', type: 'texte' }],
      entities: [
        {
          ...référence.entities[0],
          attributes: [...référence.entities[0].attributes, { propertyId: 'prop-mail', isIdentifier: false }],
        },
        référence.entities[1],
      ],
      associations: référence.associations,
    } satisfies Mcd

    expect(kinds(sansNote, référence)).toEqual(['attribute-missing'])
    expect(kinds(avecEnPlus, référence)).toEqual(['attribute-extra'])
    expect(compareMcd(avecEnPlus, référence).summary.extras).toBe(1)
  })

  it('signale un type différent', () => {
    const noteTexte = {
      ...référence,
      properties: référence.properties.map((property) =>
        property.name === 'note' ? { ...property, type: 'texte' as const } : property,
      ),
    } satisfies Mcd

    const relevé = compareMcd(noteTexte, référence)

    expect(relevé.differences.map((d) => d.kind)).toEqual(['attribute-type'])
    expect(relevé.differences[0]?.message).toContain('decimal au corrigé')
    expect(relevé.differences[0]?.message).toContain('texte au rendu')
    expect(relevé.summary.checks).toBe(1)
  })

  it('signale un rôle d’identifiant différent, dans les deux sens', () => {
    const sansIdentifiant = {
      ...référence,
      entities: [
        { ...référence.entities[0], attributes: [{ propertyId: 'prop-num-etudiant', isIdentifier: false }] },
        référence.entities[1],
      ],
    } satisfies Mcd
    const noteIdentifiante = {
      ...référence,
      associations: [
        { ...référence.associations[0], attributes: [{ propertyId: 'prop-note', isIdentifier: true }] },
      ],
    } satisfies Mcd

    expect(kinds(sansIdentifiant, référence)).toEqual(['attribute-identifier'])
    expect(messages(sansIdentifiant, référence)[0]).toContain("identifiant au corrigé, pas au rendu")
    expect(kinds(noteIdentifiante, référence)).toEqual(['attribute-identifier'])
    expect(messages(noteIdentifiante, référence)[0]).toContain('identifiant au rendu, pas au corrigé')
  })
})

describe('associations', () => {
  it('signale une association attendue absente et une en trop', () => {
    const sansAssociation = { ...clientCommande, associations: [] } satisfies Mcd
    const relevéManquante = compareMcd(sansAssociation, clientCommande)
    const relevéEnTrop = compareMcd(clientCommande, sansAssociation)

    expect(relevéManquante.differences.map((d) => d.kind)).toEqual(['association-missing'])
    expect(relevéEnTrop.differences.map((d) => d.kind)).toEqual(['association-extra'])
    expect(relevéEnTrop.summary.extras).toBe(1)
  })

  it('retrouve une association de même nom mais reliée autrement, et le signale une fois', () => {
    const autreLien = {
      properties: clientCommande.properties,
      entities: [...clientCommande.entities, { id: 'ent-facture', name: 'Facture', attributes: [] }],
      associations: [
        {
          id: 'asso-passer',
          name: 'passer',
          attributes: [],
          legs: [
            { id: 'l1', entityId: 'ent-client', cardinality: { min: 0, max: 'n' } },
            { id: 'l2', entityId: 'ent-facture', cardinality: { min: 1, max: 1 } },
          ],
        },
      ],
    } satisfies Mcd

    const relevé = compareMcd(autreLien, clientCommande)

    // Une association retrouvée, pas une absente doublée d'une en trop.
    expect(relevé.matchedAssociations).toHaveLength(1)
    expect(relevé.differences.filter((d) => d.kind === 'association-legs')).toHaveLength(1)
    expect(relevé.differences.some((d) => d.kind === 'association-missing')).toBe(false)
    expect(relevé.differences.some((d) => d.kind === 'association-extra')).toBe(false)
    expect(relevé.differences.find((d) => d.kind === 'association-legs')?.message).toContain('Commande')
  })
})

describe('cardinalités', () => {
  it('signale une cardinalité différente, du bon côté', () => {
    const relevé = compareMcd(clientCommandeOptionnel, clientCommande)

    expect(relevé.differences.map((d) => d.kind)).toEqual(['cardinality'])
    expect(relevé.differences[0]?.message).toContain('Commande')
    expect(relevé.differences[0]?.message).toContain('(1,1) au corrigé')
    expect(relevé.differences[0]?.message).toContain('(0,1) au rendu')
    expect(relevé.summary.checks).toBe(1)
  })

  it('distingue les deux pattes d’une association réflexive par leur rôle', () => {
    // Les deux pattes vont à Etudiant : seul le rôle les sépare. Ici, la
    // patte « tutore » passe de (0,1) à (1,1).
    const tutoratStrict = {
      ...tutorat,
      associations: [
        {
          ...tutorat.associations[0],
          legs: tutorat.associations[0].legs.map((leg) =>
            leg.role === 'tutore' ? { ...leg, cardinality: { min: 1 as const, max: 1 as const } } : leg,
          ),
        },
      ],
    } satisfies Mcd

    const relevé = compareMcd(tutoratStrict, tutorat)

    expect(relevé.differences.map((d) => d.kind)).toEqual(['cardinality'])
    expect(relevé.differences[0]?.message).toContain('tutore')
    expect(relevé.differences[0]?.message).toContain('(0,1) au corrigé')
    expect(relevé.differences[0]?.message).toContain('(1,1) au rendu')
    // L'autre patte, elle, ne bouge pas.
    expect(compareMcd(tutorat, tutorat).differences).toEqual([])
  })
})

describe('note indicative', () => {
  it('atteint 20 sur un rendu identique au corrigé', () => {
    expect(compareMcd(clientCommande, clientCommande).summary.suggestedGrade).toBe(20)
  })

  it('ne baisse pas pour un élément en trop', () => {
    const avecFacture = {
      ...clientCommande,
      entities: [...clientCommande.entities, { id: 'ent-facture', name: 'Facture', attributes: [] }],
    } satisfies Mcd

    expect(compareMcd(avecFacture, clientCommande).summary.suggestedGrade).toBe(20)
  })

  it('baisse quand des éléments attendus manquent', () => {
    const vide = { properties: [], entities: [], associations: [] } satisfies Mcd
    const note = compareMcd(vide, clientCommande).summary.suggestedGrade

    expect(note).toBe(0)
    expect(compareMcd(clientCommandeOptionnel, clientCommande).summary.suggestedGrade).toBeLessThan(20)
  })

  it('ne propose aucune note quand le corrigé est vide', () => {
    const vide = { properties: [], entities: [], associations: [] } satisfies Mcd

    expect(compareMcd(clientCommande, vide).summary.suggestedGrade).toBeNull()
  })

  it('écrit la note avec une virgule, sans décimale inutile', () => {
    expect(formatGrade(20)).toBe('20')
    expect(formatGrade(17.5)).toBe('17,5')
  })
})

describe('textes partageables', () => {
  it('le résumé compte sans nommer ce qui était attendu', () => {
    const sansCommande = {
      ...clientCommande,
      entities: clientCommande.entities.filter((entity) => normalizeName(entity.name) !== 'commande'),
      associations: [],
    } satisfies Mcd
    const texte = comparisonSummaryText(compareMcd(sansCommande, clientCommande))

    expect(texte).toContain('Comparaison au corrigé')
    expect(texte).not.toContain('Commande')
    expect(texte).not.toContain('passer')
    // Le ton reste celui de la vérification.
    expect(texte).toContain('n’est pas forcément une faute')
  })

  it('le détail nomme les points à regarder, groupés', () => {
    const texte = comparisonDetailText(compareMcd(clientCommandeOptionnel, clientCommande))

    expect(texte).toContain('Points à regarder')
    expect(texte).toContain('Association passer')
    expect(texte).toContain('(1,1) au corrigé')
  })

  it('le détail dit clairement qu’il n’y a rien à signaler', () => {
    const texte = comparisonDetailText(compareMcd(clientCommande, clientCommande))

    expect(texte).toContain('Aucune différence relevée')
  })

  it('ne parle jamais d’erreur ni de faute affirmée', () => {
    const relevé = compareMcd(clientCommandeOptionnel, clientCommande)

    for (const difference of relevé.differences) {
      expect(difference.message.toLowerCase()).not.toContain('erreur')
      expect(difference.message.toLowerCase()).not.toContain('incorrect')
      expect(difference.message.toLowerCase()).not.toContain('faux')
    }
  })
})
