import { describe, expect, it } from 'vitest'
import { buildCodeSchema } from './codeSchema'
import type { CodeSchema, SchemaTable } from './codeSchema'
import type { Mcd } from './mcd'
import { mcdToMld } from './mld'
import { DEFAULT_MPD_SETTINGS } from './mpd'
import type { MpdSettings } from './mpd'
import {
  clientCommande,
  clientCommandeOptionnel,
  entiteSansIdentifiant,
  inscription,
  livraisonTernaire,
  occupation,
  tutorat,
  vols,
} from './testFixtures'

/** La chaîne complète, comme la vue l'appelle. */
function schemaFor(mcd: Mcd, settings: MpdSettings = DEFAULT_MPD_SETTINGS): CodeSchema {
  return buildCodeSchema(mcd, mcdToMld(mcd), settings)
}

function tableNamed(schema: CodeSchema, className: string): SchemaTable {
  const table = schema.tables.find((candidate) => candidate.className === className)
  if (!table) throw new Error(`table ${className} absente`)
  return table
}

describe('schéma de code, noms physiques', () => {
  it('met les tables d’entités au pluriel et les colonnes en snake_case', () => {
    const schema = schemaFor(clientCommande)

    expect(schema.tables.map((table) => table.tableName)).toEqual(['clients', 'commandes'])
    expect(tableNamed(schema, 'Client').columns.map((column) => column.columnName)).toEqual([
      'numero_client',
      'nom',
    ])
    expect(tableNamed(schema, 'Commande').columns.map((column) => column.propertyName)).toEqual([
      'numeroCommande',
      'dateCommande',
      'numeroClient',
    ])
  })

  it('garde le nom d’une association de jonction, sans le mettre au pluriel', () => {
    const schema = schemaFor(inscription)

    const pivot = tableNamed(schema, 'Inscrire')
    expect(pivot.tableName).toBe('inscrire')
    expect(pivot.origin).toBe('junction')
  })

  it('renomme aussi le MPD, pour que le SQL généré suive les mêmes noms', () => {
    const schema = schemaFor(clientCommande)

    const commandes = schema.physicalTables.find((table) => table.name === 'commandes')
    const fk = commandes?.columns.find((column) => column.references !== undefined)
    expect(fk?.name).toBe('numero_client')
    expect(fk?.references?.tableName).toBe('clients')
    expect(fk?.references?.columnName).toBe('numero_client')
  })

  it('reprend les types et les surcharges du MPD', () => {
    const schema = schemaFor(inscription)
    const cours = tableNamed(schema, 'Cours')
    const code = cours.columns.find((column) => column.columnName === 'code_cours')
    expect(code).toMatchObject({ conceptualType: 'texte', size: 10, sqlType: 'VARCHAR(10)' })

    const surcharge = schemaFor(inscription, {
      dialect: 'mysql',
      overrides: { 'prop-code-cours': 'CHAR(10)' },
    })
    const surchargee = tableNamed(surcharge, 'Cours').columns.find(
      (column) => column.columnName === 'code_cours',
    )
    expect(surchargee).toMatchObject({ sqlType: 'CHAR(10)', overridden: true })
  })
})

describe('schéma de code, plusieurs à un', () => {
  it('pose un plusieurs à un du côté de la clé, et son inverse en face', () => {
    const schema = schemaFor(clientCommande)

    const commande = tableNamed(schema, 'Commande').relations
    expect(commande).toHaveLength(1)
    expect(commande[0]).toMatchObject({
      kind: 'manyToOne',
      name: 'client',
      inverseName: 'commandes',
      nullable: false,
      selfReferencing: false,
      key: [{ foreignColumn: 'numero_client', referencedColumn: 'numero_client' }],
    })
    expect(commande[0]?.comment).toBe('Commande (1,1) passer Client (0,n).')

    const client = tableNamed(schema, 'Client').relations
    expect(client).toHaveLength(1)
    expect(client[0]).toMatchObject({ kind: 'oneToMany', name: 'commandes', inverseName: 'client' })
    expect(client[0]?.comment).toBe('Client (0,n) passer Commande (1,1).')
  })

  it('rend la relation facultative quand la patte porteuse est à min 0', () => {
    const schema = schemaFor(clientCommandeOptionnel)

    expect(tableNamed(schema, 'Commande').relations[0]).toMatchObject({ nullable: true })
  })
})

describe('schéma de code, un à un', () => {
  it('reconnaît un un à un et place la clé du côté obligatoire', () => {
    const schema = schemaFor(occupation)

    const employe = tableNamed(schema, 'Employe')
    expect(employe.columns.map((column) => column.columnName)).toContain('numero_bureau')
    expect(employe.relations[0]).toMatchObject({
      kind: 'oneToOne',
      name: 'bureau',
      inverseName: 'employe',
    })
    expect(tableNamed(schema, 'Bureau').relations[0]).toMatchObject({
      kind: 'oneToOneInverse',
      name: 'employe',
      inverseName: 'bureau',
    })
  })
})

describe('schéma de code, plusieurs à plusieurs', () => {
  it('donne une vue pivot de chaque côté, avec les attributs portés', () => {
    const schema = schemaFor(inscription)

    const etudiant = tableNamed(schema, 'Etudiant')
    const cours = tableNamed(schema, 'Cours')
    expect(etudiant.manyToMany).toHaveLength(1)
    expect(etudiant.manyToMany[0]).toMatchObject({
      name: 'cours',
      inverseName: 'etudiants',
      owner: true,
      pivotTableName: 'inscrire',
      composite: false,
      localKey: [{ foreignColumn: 'numero_etudiant', referencedColumn: 'numero_etudiant' }],
      targetKey: [{ foreignColumn: 'code_cours', referencedColumn: 'code_cours' }],
    })
    expect(etudiant.manyToMany[0]?.payloadColumns.map((column) => column.columnName)).toEqual(['note'])
    expect(cours.manyToMany[0]).toMatchObject({ name: 'etudiants', owner: false })
  })

  it('garde aussi la lecture jonction, avec ses deux plusieurs à un', () => {
    const schema = schemaFor(inscription)

    const pivot = tableNamed(schema, 'Inscrire')
    expect(pivot.legCount).toBe(2)
    expect(pivot.relations.map((relation) => relation.kind)).toEqual(['manyToOne', 'manyToOne'])
    expect(pivot.relations.map((relation) => relation.name)).toEqual(['etudiant', 'cours'])
    expect(pivot.carriedColumns.map((column) => column.columnName)).toEqual(['note'])
    expect(pivot.primaryKey.map((column) => column.columnName)).toEqual(['numero_etudiant', 'code_cours'])
  })

  it('ne lit pas un ternaire en plusieurs à plusieurs', () => {
    const schema = schemaFor(livraisonTernaire)

    const pivot = tableNamed(schema, 'Livrer')
    expect(pivot.legCount).toBe(3)
    expect(pivot.manyToMany).toEqual([])
    expect(pivot.relations).toHaveLength(3)
    expect(pivot.relations.every((relation) => relation.kind === 'manyToOne')).toBe(true)
    expect(pivot.carriedColumns.map((column) => column.columnName)).toEqual(['quantite', 'livree_le'])
    for (const className of ['Fournisseur', 'Produit', 'Magasin']) {
      expect(tableNamed(schema, className).manyToMany).toEqual([])
      expect(tableNamed(schema, className).relations[0]).toMatchObject({ kind: 'oneToMany' })
    }
  })
})

describe('schéma de code, réflexivité et clé composée', () => {
  it('nomme une relation réflexive d’après les rôles', () => {
    const schema = schemaFor(tutorat)

    const etudiant = tableNamed(schema, 'Etudiant')
    expect(etudiant.relations.map((relation) => relation.name)).toEqual(['tuteur', 'tutores'])
    expect(etudiant.relations.every((relation) => relation.selfReferencing)).toBe(true)
    expect(etudiant.relations[0]).toMatchObject({
      kind: 'manyToOne',
      nullable: true,
      key: [{ foreignColumn: 'tuteur_numero_etudiant', referencedColumn: 'numero_etudiant' }],
    })
  })

  it('porte une clé étrangère composée en entier', () => {
    const schema = schemaFor(vols)

    expect(tableNamed(schema, 'Vol').primaryKey.map((column) => column.columnName)).toEqual([
      'numero_vol',
      'date_vol',
    ])
    expect(tableNamed(schema, 'Reservation').relations[0]?.key).toEqual([
      { foreignColumn: 'numero_vol', referencedColumn: 'numero_vol' },
      { foreignColumn: 'date_vol', referencedColumn: 'date_vol' },
    ])
    expect(tableNamed(schema, 'Passager').manyToMany[0]).toMatchObject({
      composite: true,
      pivotTableName: 'embarquer',
    })
  })
})

describe('schéma de code, modèle incomplet', () => {
  it('tient debout quand une entité n’a pas d’identifiant', () => {
    const schema = schemaFor(entiteSansIdentifiant)

    const note = tableNamed(schema, 'Note')
    expect(note.primaryKey).toEqual([])
    // La relation vers Devoir existe : c'est Note qui porte la clé.
    expect(note.relations[0]).toMatchObject({ kind: 'manyToOne', name: 'devoir' })
    expect(tableNamed(schema, 'Devoir').relations[0]).toMatchObject({ kind: 'oneToMany', name: 'notes' })
    // En revanche aucune colonne ne peut viser Note, qui n'a pas de clé.
    const versNote = schema.tables.flatMap((table) =>
      table.columns.filter((column) => column.foreignKey?.targetTableId === 'ent-note'),
    )
    expect(versNote).toEqual([])
  })

  it('ne produit rien d’un modèle vide', () => {
    const schema = schemaFor({ properties: [], entities: [], associations: [] })

    expect(schema.tables).toEqual([])
    expect(schema.physicalTables).toEqual([])
  })
})
