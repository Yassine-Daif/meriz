import { describe, expect, it } from 'vitest'
import {
  pluralize,
  toCamelCase,
  toPascalCase,
  toPluralSnakeCase,
  toSnakeCase,
  uniqueName,
  words,
} from './names'

describe('noms de code, découpage et casse', () => {
  it('découpe sur les séparateurs et les majuscules', () => {
    expect(words('numeroClient')).toEqual(['numero', 'Client'])
    expect(words('code_cours')).toEqual(['code', 'cours'])
    expect(words('Ligne commande')).toEqual(['Ligne', 'commande'])
    expect(words('Numéro de téléphone')).toEqual(['Numero', 'de', 'telephone'])
    expect(words("Chiffre d'affaires")).toEqual(['Chiffre', 'd', 'affaires'])
  })

  it('garde les chiffres collés au mot', () => {
    expect(toSnakeCase('adresse2')).toBe('adresse2')
  })

  it('rend les trois casses', () => {
    expect(toSnakeCase('numeroClient')).toBe('numero_client')
    expect(toCamelCase('code_cours')).toBe('codeCours')
    expect(toPascalCase('ligne commande')).toBe('LigneCommande')
    expect(toPascalCase('numéro de téléphone')).toBe('NumeroDeTelephone')
  })

  it('protège les noms impossibles en PHP', () => {
    expect(toSnakeCase('')).toBe('sans_nom')
    expect(toCamelCase('   ')).toBe('sansNom')
    expect(toPascalCase('2 roues')).toBe('_2Roues')
    // Mot réservé : une classe nommée `List` ne compilerait pas.
    expect(toPascalCase('list')).toBe('_List')
    expect(toCamelCase('class')).toBe('_class')
  })
})

describe('noms de code, pluriel français', () => {
  it('ajoute un s au cas courant', () => {
    expect(pluralize('client')).toBe('clients')
    expect(pluralize('commande')).toBe('commandes')
    expect(pluralize('reservation')).toBe('reservations')
  })

  it('laisse les mots en s, x ou z tranquilles', () => {
    expect(pluralize('cours')).toBe('cours')
    expect(pluralize('prix')).toBe('prix')
    expect(pluralize('nez')).toBe('nez')
  })

  it('met un x aux mots en eau, au et eu', () => {
    expect(pluralize('bureau')).toBe('bureaux')
    expect(pluralize('jeu')).toBe('jeux')
    expect(pluralize('pneu')).toBe('pneus')
  })

  it('met aux aux mots en al, sauf les exceptions', () => {
    expect(pluralize('journal')).toBe('journaux')
    expect(pluralize('festival')).toBe('festivals')
  })

  it('traite les mots en ail et en ou', () => {
    expect(pluralize('travail')).toBe('travaux')
    expect(pluralize('detail')).toBe('details')
    expect(pluralize('email')).toBe('emails')
    expect(pluralize('bijou')).toBe('bijoux')
    expect(pluralize('trou')).toBe('trous')
  })

  it('ne redouble pas un nom déjà au pluriel', () => {
    expect(toPluralSnakeCase('Clients')).toBe('clients')
    expect(toPluralSnakeCase(toPluralSnakeCase('Client'))).toBe('clients')
  })

  it('met au pluriel le dernier mot seulement', () => {
    expect(toPluralSnakeCase('LigneCommande')).toBe('ligne_commandes')
    expect(toPluralSnakeCase('Client')).toBe('clients')
    expect(toPluralSnakeCase('Cours')).toBe('cours')
  })
})

describe('noms de code, unicité', () => {
  it('suffixe un nom déjà pris, sans tenir compte de la casse', () => {
    const used = new Set<string>()
    expect(uniqueName('client', used)).toBe('client')
    expect(uniqueName('Client', used)).toBe('Client2')
    expect(uniqueName('client', used)).toBe('client3')
  })
})
