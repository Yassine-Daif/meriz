import { describe, expect, it } from 'vitest'
import { createModelDoc } from './modelDoc'
import type { ModelDoc } from './modelDoc'
import { mcdReducer } from './mcdReducer'
import type { McdEditorState } from './mcdReducer'
import { clientCommande } from './testFixtures'
import { findPlacement } from './queries'
import { buildMpd } from './mpd'
import { mcdToMld } from './mld'
import { parseModelFile, serializeModel } from '../lib/persistence'
import { frameworkCommands } from './frameworkCommands'
import { generateFiles } from './codegen'
import { formatSqlType, MYSQL_TYPES, parseSqlType, POSTGRES_TYPES, sqlTypeForDialect } from './sqlTypes'
import { physicalSchemaIssues } from './physicalSchema'

const initial = (): McdEditorState => ({ mcd: structuredClone(clientCommande), layout: {}, mpd: { dialect: 'mysql', overrides: {} } })
function exchange(a: ModelDoc, b: ModelDoc) { const x = a.sync.diffSince(b.sync.stateVector()), y = b.sync.diffSince(a.sync.stateVector()); a.sync.applyRemote(y); b.sync.applyRemote(x) }
function pair() { const a = createModelDoc(initial()), b = createModelDoc(initial(), { seed: false }); exchange(a, b); return [a, b] as const }

describe('déplacements du dictionnaire et direct', () => {
  it('déplace la référence, conserve la propriété et ses réglages physiques', () => {
    const state = initial(); state.mpd!.overrides['prop-nom-client'] = 'VARCHAR(150)'
    const next = mcdReducer(state, { type: 'MOVE_PROPERTY', propertyId: 'prop-nom-client', ownerId: 'ent-commande' })
    expect(next.mcd.properties).toBe(state.mcd.properties)
    expect(findPlacement(next.mcd, 'prop-nom-client')?.owner.id).toBe('ent-commande')
    expect(next.mpd).toBe(state.mpd)
    expect(next.mcd.entities.flatMap(e => e.attributes).filter(r => r.propertyId === 'prop-nom-client')).toHaveLength(1)
  })
  it('refuse un porteur inexistant sans défaire le placement', () => {
    const state = initial()
    expect(mcdReducer(state, { type: 'MOVE_PROPERTY', propertyId: 'prop-nom-client', ownerId: 'absent' })).toBe(state)
  })
  it('retire le rôle identifiant en déplaçant vers une association, sans supprimer la propriété', () => {
    const next = mcdReducer(initial(), { type: 'MOVE_PROPERTY', propertyId: 'prop-num-client', ownerId: 'asso-passer' })
    expect(next.mcd.associations[0]!.attributes[0]).toMatchObject({ propertyId: 'prop-num-client', isIdentifier: false })
    expect(next.mcd.properties).toHaveLength(4)
  })
  it('réordonne les références existantes, puis annule et rétablit ce geste', () => {
    const doc = createModelDoc(initial())
    try {
      doc.apply({ type: 'MOVE_PROPERTY', propertyId: 'prop-nom-client', ownerId: 'ent-client', beforeId: 'prop-num-client' })
      expect(doc.snapshot().mcd.entities[0]!.attributes.map(a => a.propertyId)).toEqual(['prop-nom-client', 'prop-num-client'])
      doc.undo(); expect(doc.snapshot().mcd.entities[0]!.attributes.map(a => a.propertyId)).toEqual(['prop-num-client', 'prop-nom-client'])
      doc.redo(); expect(doc.snapshot().mcd.entities[0]!.attributes[0]!.propertyId).toBe('prop-nom-client')
    } finally { doc.destroy() }
  })
  it('converge vers un seul placement après deux déplacements concurrents', () => {
    const [a, b] = pair()
    try {
      a.apply({ type: 'MOVE_PROPERTY', propertyId: 'prop-nom-client', ownerId: 'ent-commande' })
      b.apply({ type: 'MOVE_PROPERTY', propertyId: 'prop-nom-client', ownerId: 'asso-passer' })
      exchange(a, b)
      expect(a.snapshot()).toEqual(b.snapshot())
      const state = a.snapshot().mcd
      expect([...state.entities, ...state.associations].flatMap(e => e.attributes).filter(ref => ref.propertyId === 'prop-nom-client')).toHaveLength(1)
      expect(state.properties).toHaveLength(4)
    } finally { a.destroy(); b.destroy() }
  })
  it('annule son déplacement sans annuler un renommage distant', () => {
    const [a, b] = pair()
    try {
      a.apply({ type: 'MOVE_PROPERTY', propertyId: 'prop-nom-client', ownerId: 'ent-commande' }); exchange(a, b)
      b.apply({ type: 'UPDATE_PROPERTY', propertyId: 'prop-nom-client', patch: { name: 'nomModifié' } }); exchange(a, b)
      a.undo(); exchange(a, b)
      expect(findPlacement(a.snapshot().mcd, 'prop-nom-client')?.owner.id).toBe('ent-client')
      expect(a.snapshot().mcd.properties.find(p => p.id === 'prop-nom-client')?.name).toBe('nomModifié')
      expect(a.snapshot()).toEqual(b.snapshot())
    } finally { a.destroy(); b.destroy() }
  })
  it('fusionne des réglages SQL concurrents portant sur deux propriétés', () => {
    const [a, b] = pair()
    try {
      a.apply({ type: 'SET_SQL_TYPE', propertyId: 'prop-nom-client', value: 'VARCHAR(150)' })
      b.apply({ type: 'SET_SQL_TYPE', propertyId: 'prop-date-commande', value: 'TIMESTAMP' })
      exchange(a, b)
      expect(a.snapshot()).toEqual(b.snapshot())
      expect(a.snapshot().mpd!.overrides).toMatchObject({ 'prop-nom-client': 'VARCHAR(150)', 'prop-date-commande': 'TIMESTAMP' })
      const settings = a.snapshot().mpd
      a.apply({ type: 'MOVE_NODE', id: 'ent-client', position: { x: 10, y: 20 } })
      expect(a.snapshot().mpd).toBe(settings)
    } finally { a.destroy(); b.destroy() }
  })
  it('retrouve les paramètres et l’ordre après export et réimportation', () => {
    const doc = createModelDoc(initial())
    try {
      doc.apply({ type: 'SET_SQL_TYPE', propertyId: 'prop-num-client', value: 'BIGINT' })
      doc.apply({ type: 'SET_IDENTITY', propertyId: 'prop-num-client', value: true })
      doc.apply({ type: 'MOVE_PROPERTY', propertyId: 'prop-nom-client', ownerId: 'ent-commande' })
      const result = parseModelFile(serializeModel(doc.snapshot(), doc.snapshot().mpd!))
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.state.mcd).toEqual(doc.snapshot().mcd)
      expect(result.mpdSettings).toEqual(doc.snapshot().mpd)
    } finally { doc.destroy() }
  })
})

describe('types SQL et code de framework', () => {
  it('propose un catalogue limité, avec des noms SQL exacts', () => {
    expect(MYSQL_TYPES.length).toBeLessThanOrEqual(20); expect(POSTGRES_TYPES.length).toBeLessThanOrEqual(20)
    expect(MYSQL_TYPES).toContain('VARCHAR'); expect(POSTGRES_TYPES).toContain('UUID')
    expect(parseSqlType('var_char')).toBeNull()
  })
  for (const raw of ['VARCHAR(0)', 'VARCHAR(1.5)', 'DECIMAL(3,8)', 'DECIMAL(1001,2)', "ENUM('a','a')", "ENUM('a',)", 'INT); DROP TABLE users; --']) it('refuse les paramètres invalides : ' + raw, () => expect(parseSqlType(raw)).toBeNull())
  it('conserve les apostrophes des valeurs énumérées', () => {
    const spec = { name: 'ENUM' as const, values: ["aujourd’hui", "l'élève", 'en cours'] }
    expect(parseSqlType(formatSqlType(spec))).toEqual(spec)
  })
  it('ne transforme pas silencieusement un UUID en texte MySQL', () => expect(sqlTypeForDialect({ name: 'UUID' }, 'mysql')).toBeNull())
  it('propage le type choisi aux clés étrangères', () => {
    const state = initial(); state.mpd!.overrides['prop-num-client'] = 'BIGINT'
    const tables = buildMpd(mcdToMld(state.mcd), state.mpd!)
    expect(tables.find(t => t.id === 'ent-commande')?.columns.find(c => c.references)?.sqlType).toBe('BIGINT')
    expect(physicalSchemaIssues(tables, 'mysql')).toEqual([])
  })
  it('génère VARCHAR et DECIMAL avec leurs vrais paramètres dans les deux frameworks', () => {
    const state = initial(); state.mpd!.overrides = { 'prop-nom-client': 'VARCHAR(150)', 'prop-date-commande': 'DECIMAL(12,4)' }
    const laravel = generateFiles('laravel', state.mcd, mcdToMld(state.mcd), state.mpd!).map(f => f.content).join('\n')
    expect(laravel).toContain("$table->string('nom', 150)"); expect(laravel).toContain("$table->decimal('date_commande', 12, 4)")
    const symfony = generateFiles('symfony', state.mcd, mcdToMld(state.mcd), state.mpd!).map(f => f.content).join('\n')
    expect(symfony).toContain('length: 150'); expect(symfony).toContain('precision: 12, scale: 4')
    expect(symfony).toContain('private ?string $dateCommande')
  })
  it('ne propose pas une seconde migration Symfony dans le parcours des entités', () => {
    const state = initial(), files = generateFiles('symfony', state.mcd, mcdToMld(state.mcd), state.mpd!)
    const plan = frameworkCommands('symfony', files, 'entities')
    expect(plan.files.every(f => !f.path.startsWith('migrations/'))).toBe(true)
    expect(plan.commands).toContain('php bin/console make:migration')
    expect(frameworkCommands('symfony', files, 'migration').commands).not.toContain('php bin/console make:migration')
  })
})
