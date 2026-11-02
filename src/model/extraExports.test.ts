import { describe, expect, it } from 'vitest'
import { doctrineCompatibilityWarnings } from './frameworkCompatibility'
import { buildMpd, mpdToSql } from './mpd'
import { mcdToMld } from './mld'
import { clientCommande } from './testFixtures'
import { generateFiles } from './codegen'
import { frameworkCommands } from './frameworkCommands'
import type { McdEditorState } from './mcdReducer'

const initial = (): McdEditorState => ({ mcd: structuredClone(clientCommande), layout: {}, mpd: { dialect: 'mysql', overrides: {} } })
describe('compatibilité des exports de framework', () => {
  it('adapte le chemin et le namespace aux deux configurations Symfony', () => {
    const state = initial(), files = generateFiles('symfony', state.mcd, mcdToMld(state.mcd), state.mpd!)
    const modern = frameworkCommands('symfony', files, 'migration', 'modern').files.find(file => file.path.startsWith('src/Migrations/'))
    expect(modern?.content).toContain('namespace App\\Migrations;')
    expect(frameworkCommands('symfony', files, 'migration', 'classic').files.some(file => file.path.startsWith('migrations/'))).toBe(true)
  })
  it('signale les types non portables dans Doctrine, sans tenir compte des réglages orphelins', () => {
    const state = initial(); state.mpd!.overrides = { 'prop-nom-client': 'TINYINT', orphelin: 'TIMESTAMP' }
    const warnings = doctrineCompatibilityWarnings(state.mpd!, buildMpd(mcdToMld(state.mcd), state.mpd!))
    expect(warnings).toHaveLength(1); expect(warnings[0]).toContain('TINYINT')
  })
  it('conserve les apostrophes des ENUM Laravel sans produire de SQL invalide', () => {
    const state = initial(); state.mpd!.overrides['prop-nom-client'] = "ENUM('en cours','l''élève')"
    const files = generateFiles('laravel', state.mcd, mcdToMld(state.mcd), state.mpd!)
    expect(files.some(file => file.content.includes('rawColumn'))).toBe(true)
  })
  it('ajoute les clés étrangères cycliques après toutes les créations de tables', () => {
    const state = initial()
    state.mcd.associations.push({ id: 'inverse', name: 'inverse', attributes: [], legs: [
      { id: 'inverse-client', entityId: 'ent-client', cardinality: { min: 0, max: 1 } },
      { id: 'inverse-commande', entityId: 'ent-commande', cardinality: { min: 0, max: 'n' } },
    ] })
    const files = generateFiles('laravel', state.mcd, mcdToMld(state.mcd), state.mpd!)
    const migrations = files.filter(file => file.path.startsWith('database/migrations/'))
    expect(migrations).toHaveLength(3)
    expect(migrations[2]!.path).toContain('add_meriz_foreign_keys')
    expect(migrations[2]!.content).toContain("Schema::table('clients'")
    expect(migrations[2]!.content).toContain("dropForeign(['numero_commande'])")
    expect(migrations[0]!.content).not.toContain("->on('commandes')")
  })
  it('protège les mots-clés SQL des noms saisis, y compris Order en anglais', () => {
    const state = initial(); state.mcd.entities[1]!.name = 'Order'
    const tables = buildMpd(mcdToMld(state.mcd), state.mpd!), tick = String.fromCharCode(96)
    expect(mpdToSql(tables, 'mysql', { includeDrops: false })).toContain('CREATE TABLE ' + tick + 'Order' + tick)
    expect(mpdToSql(tables, 'postgresql', { includeDrops: false })).toContain('CREATE TABLE "Order"')
  })
  it('conserve NOT NULL pour les types temporels PostgreSQL natifs de Doctrine', () => {
    const state = initial(); state.mpd!.dialect = 'postgresql'
    state.mcd.properties.find(p => p.id === 'prop-nom-client')!.type = 'datetime'
    state.mpd!.overrides['prop-nom-client'] = 'TIMESTAMP WITH TIME ZONE'
    const entities = generateFiles('symfony', state.mcd, mcdToMld(state.mcd), state.mpd!)
    expect(entities.some(file => file.content.includes("columnDefinition: 'TIMESTAMP WITH TIME ZONE NOT NULL'"))).toBe(true)
  })
  it('retire les contraintes avant les tables dans le retour arrière Doctrine', () => {
    const state = initial(), files = generateFiles('symfony', state.mcd, mcdToMld(state.mcd), state.mpd!)
    const migration = files.find(file => file.path.startsWith('migrations/'))!.content
    const down = migration.slice(migration.indexOf('public function down'))
    expect(down.indexOf('DROP FOREIGN KEY')).toBeLessThan(down.indexOf('DROP TABLE'))
  })

})
