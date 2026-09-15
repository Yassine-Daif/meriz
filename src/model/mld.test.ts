import { describe, expect, it } from 'vitest'
import { mcdToMld } from './mld'
import type { MldTable } from './mld'
import { clientCommande, clientCommandeOptionnel, inscription, tutorat, vols } from './testFixtures'

/** Table du MLD par son nom, échec explicite si elle manque. */
function tableNamed(tables: MldTable[], name: string): MldTable {
  const table = tables.find((t) => t.name === name)
  if (!table) {
    throw new Error(`Table « ${name} » absente du MLD`)
  }
  return table
}

function columnNames(table: MldTable): string[] {
  return table.columns.map((column) => column.name)
}

function primaryKeyNames(table: MldTable): string[] {
  return table.columns.filter((column) => column.isPrimaryKey).map((column) => column.name)
}

describe('mcdToMld, règle 1 : entité vers table', () => {
  it("fait de chaque entité une table dont l'identifiant devient la clé primaire", () => {
    const tables = mcdToMld(clientCommande)
    expect(columnNames(tableNamed(tables, 'Client'))).toEqual(['numeroClient', 'nom'])
    expect(primaryKeyNames(tableNamed(tables, 'Client'))).toEqual(['numeroClient'])
  })
})

describe('mcdToMld, règle 2 : patte à maximum 1', () => {
  it('place la clé étrangère dans la table de la patte à maximum 1', () => {
    const tables = mcdToMld(clientCommande)
    const commande = tableNamed(tables, 'Commande')
    const foreignKey = commande.columns.find((column) => column.name === 'numeroClient')

    expect(foreignKey).toMatchObject({
      isPrimaryKey: false,
      nullable: false,
      references: { tableId: 'ent-client', tableName: 'Client', columnName: 'numeroClient' },
    })
  })

  it("ne crée ni clé étrangère côté maximum n, ni table pour l'association", () => {
    const tables = mcdToMld(clientCommande)
    expect(tableNamed(tables, 'Client').columns.every((column) => !column.references)).toBe(true)
    expect(tables.map((t) => t.name)).toEqual(['Client', 'Commande'])
  })

  it('rend la clé étrangère facultative quand le minimum vaut 0', () => {
    const commande = tableNamed(mcdToMld(clientCommandeOptionnel), 'Commande')
    expect(commande.columns.find((column) => column.name === 'numeroClient')?.nullable).toBe(true)
  })
})

describe('mcdToMld, règle 3 : table de jonction', () => {
  it('crée une table de jonction à clé primaire composée quand toutes les pattes sont à maximum n', () => {
    const inscrire = tableNamed(mcdToMld(inscription), 'inscrire')

    expect(primaryKeyNames(inscrire)).toEqual(['numeroEtudiant', 'codeCours'])
    expect(inscrire.columns.find((c) => c.name === 'numeroEtudiant')?.references?.tableName).toBe(
      'Etudiant',
    )
    expect(inscrire.columns.find((c) => c.name === 'codeCours')?.references?.tableName).toBe('Cours')
  })

  it("y ajoute les propriétés portées par l'association, hors clé primaire", () => {
    const inscrire = tableNamed(mcdToMld(inscription), 'inscrire')
    const note = inscrire.columns.find((c) => c.name === 'note')
    expect(note?.isPrimaryKey).toBe(false)
    expect(note?.references).toBeUndefined()
  })

  it('reporte la longueur de la clé primaire visée sur la colonne étrangère', () => {
    const inscrire = tableNamed(mcdToMld(inscription), 'inscrire')
    expect(inscrire.columns.find((c) => c.name === 'codeCours')?.size).toBe(10)
  })
})

describe('mcdToMld, association réflexive', () => {
  it('préfixe la colonne étrangère par le rôle de la patte visée', () => {
    const tables = mcdToMld(tutorat)
    const etudiant = tableNamed(tables, 'Etudiant')

    expect(tables).toHaveLength(1)
    expect(columnNames(etudiant)).toEqual(['numeroEtudiant', 'tuteur_numeroEtudiant'])
    expect(etudiant.columns[1]).toMatchObject({
      isPrimaryKey: false,
      nullable: true,
      references: { tableName: 'Etudiant', columnName: 'numeroEtudiant' },
    })
  })
})

describe('mcdToMld, identifiant composé', () => {
  it('fait une clé primaire de toutes les propriétés identifiantes', () => {
    expect(primaryKeyNames(tableNamed(mcdToMld(vols), 'Vol'))).toEqual(['numeroVol', 'dateVol'])
  })

  it('reporte la clé composée entière, en un seul groupe de clé étrangère', () => {
    const reservation = tableNamed(mcdToMld(vols), 'Reservation')
    const foreignKeys = reservation.columns.filter((column) => column.references)

    expect(foreignKeys.map((column) => column.name)).toEqual(['numeroVol', 'dateVol'])
    expect(new Set(foreignKeys.map((column) => column.references?.group)).size).toBe(1)
    expect(foreignKeys.every((column) => !column.nullable && !column.isPrimaryKey)).toBe(true)
  })

  it('reporte la clé composée entière dans une table de jonction', () => {
    const embarquer = tableNamed(mcdToMld(vols), 'embarquer')
    expect(primaryKeyNames(embarquer)).toEqual(['numeroPassager', 'numeroVol', 'dateVol'])
  })
})
