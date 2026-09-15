import { describe, expect, it } from 'vitest'
import type { Mcd } from './mcd'
import { mcdToMld } from './mld'
import { buildMpd, DEFAULT_MPD_SETTINGS, mpdToSql } from './mpd'
import type { MpdSettings, SqlDialect } from './mpd'
import { clientCommande, inscription, vols } from './testFixtures'

/** Chaîne complète MCD, MLD, MPD, SQL, telle que l'application la dérive. */
function sqlFor(
  mcd: Mcd,
  dialect: SqlDialect = 'mysql',
  options: { includeDrops?: boolean; overrides?: MpdSettings['overrides'] } = {},
): string {
  const settings: MpdSettings = { dialect, overrides: options.overrides ?? {} }
  return mpdToSql(buildMpd(mcdToMld(mcd), settings), dialect, {
    includeDrops: options.includeDrops ?? false,
  })
}

/** Bloc CREATE TABLE d'une table, échec explicite s'il manque. */
function createBlock(sql: string, tableName: string): string {
  const block = sql.split('\n\n').find((part) => part.startsWith(`CREATE TABLE ${tableName} (`))
  if (!block) {
    throw new Error(`CREATE TABLE ${tableName} absent du script`)
  }
  return block
}

describe('mpdToSql, clés étrangères', () => {
  it('déclare la clé étrangère en ALTER TABLE, du côté de la patte à maximum 1', () => {
    expect(sqlFor(clientCommande)).toContain(
      'ALTER TABLE Commande\n  ADD CONSTRAINT fk_commande_client FOREIGN KEY (numeroClient) REFERENCES Client (numeroClient);',
    )
  })

  it('déclare une clé étrangère composée en une seule contrainte', () => {
    const sql = sqlFor(vols)
    expect(sql).toContain(
      'ADD CONSTRAINT fk_reservation_vol FOREIGN KEY (numeroVol, dateVol) REFERENCES Vol (numeroVol, dateVol);',
    )
    expect(sql).toContain(
      'ADD CONSTRAINT fk_embarquer_vol FOREIGN KEY (numeroVol, dateVol) REFERENCES Vol (numeroVol, dateVol);',
    )
    expect(sql.match(/REFERENCES Vol /g)).toHaveLength(2)
  })
})

describe('mpdToSql, clés primaires', () => {
  it('déclare la clé primaire composée de la table de jonction', () => {
    const inscrire = createBlock(sqlFor(inscription), 'inscrire')
    expect(inscrire).toContain('PRIMARY KEY (numeroEtudiant, codeCours)')
    expect(inscrire).toContain('codeCours VARCHAR(10) NOT NULL')
    expect(inscrire).not.toContain('AUTO_INCREMENT')
  })

  it("déclare la clé primaire composée d'une entité, sans auto-incrément", () => {
    const vol = createBlock(sqlFor(vols), 'Vol')
    expect(vol).toContain('PRIMARY KEY (numeroVol, dateVol)')
    expect(vol).not.toContain('AUTO_INCREMENT')
  })
})

describe('mpdToSql, dialectes', () => {
  it('MySQL : auto-incrément sur une clé primaire entière simple', () => {
    const client = createBlock(sqlFor(clientCommande, 'mysql'), 'Client')
    expect(client).toContain('numeroClient INT NOT NULL AUTO_INCREMENT')
  })

  it("PostgreSQL : SERIAL remplace le type et porte l'auto-incrément", () => {
    const sql = sqlFor(clientCommande, 'postgresql')
    expect(createBlock(sql, 'Client')).toContain('numeroClient SERIAL NOT NULL')
    expect(sql).not.toContain('AUTO_INCREMENT')
  })

  it("jamais d'auto-incrément sur une colonne étrangère", () => {
    const commande = createBlock(sqlFor(clientCommande), 'Commande')
    expect(commande).toContain('numeroClient INT NOT NULL,')
  })
})

describe('mpdToSql, ordre des instructions', () => {
  it('crée une table référencée avant la table qui la référence', () => {
    const sql = sqlFor(clientCommande)
    expect(sql.indexOf('CREATE TABLE Client')).toBeLessThan(sql.indexOf('CREATE TABLE Commande'))
  })

  it("supprime les tables dans l'ordre inverse des dépendances", () => {
    const sql = sqlFor(clientCommande, 'mysql', { includeDrops: true })
    expect(sql.startsWith('DROP TABLE IF EXISTS Commande;\nDROP TABLE IF EXISTS Client;')).toBe(true)
  })
})

describe('buildMpd, mappage des types', () => {
  it('propose les types par défaut du dialecte', () => {
    const [client] = buildMpd(mcdToMld(clientCommande), DEFAULT_MPD_SETTINGS)
    expect(client?.columns.map((column) => column.sqlType)).toEqual(['INT', 'VARCHAR(255)'])
  })

  it("applique une surcharge de type et coupe alors l'auto-incrément", () => {
    const sql = sqlFor(clientCommande, 'mysql', { overrides: { 'prop-num-client': 'BIGINT' } })
    const client = createBlock(sql, 'Client')
    expect(client).toContain('numeroClient BIGINT NOT NULL,')
    expect(client).not.toContain('AUTO_INCREMENT')
  })
})
