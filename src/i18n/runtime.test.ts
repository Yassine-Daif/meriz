import { afterEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { getLanguage, parseLanguage, setLanguage, t, translate } from './runtime'
import { counted } from '../lib/plural'
import { formatDate } from '../lib/formatDate'
import { clientCommande } from '../model/testFixtures'
import { validate } from '../model/validate'
import { mcdToMld } from '../model/mld'
import { buildMpd, DEFAULT_MPD_SETTINGS, mpdToSql } from '../model/mpd'
import { generateFiles } from '../model/codegen'
import { builtInExample } from './builtInExample'
import { exampleMcd } from '../model/example'
import { Translated } from '../components/ui/Translated'

afterEach(() => setLanguage('fr'))

describe('français et anglais', () => {
  it('ne reconnaît que les langues prises en charge', () => {
    expect(parseLanguage('en')).toBe('en')
    expect(parseLanguage('fr')).toBe('fr')
    expect(parseLanguage('en<script>')).toBeNull()
    expect(parseLanguage(null)).toBeNull()
  })
  it('change les messages et les dates, sans perdre les valeurs interpolées', () => {
    const name = 'Commande <script>é</script>'
    expect(translate('Entité {0}', [name], 'en')).toBe('Entity ' + name)
    expect(translate('Entité {0}', [name], 'fr')).toBe('Entité ' + name)
    setLanguage('en')
    expect(getLanguage()).toBe('en')
    expect(t('Réessayer')).toBe('Try again')
    expect(formatDate('2026-10-21T12:00:00Z')).toContain('October')
    setLanguage('fr')
    expect(t('Réessayer')).toBe('Réessayer')
    expect(formatDate('2026-10-21T12:00:00Z')).toContain('octobre')
  })
  it('accorde zéro, un et plusieurs selon la langue', () => {
    expect(counted(0, 'membre', 'membres')).toBe('0 membre')
    setLanguage('en')
    expect(counted(0, 'membre', 'membres')).toBe('0 members')
    expect(counted(1, 'propriété au dictionnaire', 'propriétés au dictionnaire')).toBe('1 dictionary property')
    expect(counted(2, 'propriété au dictionnaire', 'propriétés au dictionnaire')).toBe('2 dictionary properties')
  })
  it('garde le modèle, les noms saisis et le SQL identiques', () => {
    const snapshot = JSON.stringify(clientCommande)
    const tables = buildMpd(mcdToMld(clientCommande), DEFAULT_MPD_SETTINGS)
    const french = mpdToSql(tables, 'mysql', { includeDrops: false })
    setLanguage('en')
    expect(mpdToSql(tables, 'mysql', { includeDrops: false })).toBe(french)
    expect(JSON.stringify(clientCommande)).toBe(snapshot)
    const invalid = { ...clientCommande, entities: clientCommande.entities.map(entity => ({ ...entity, attributes: [] })) }
    expect(validate(invalid).some(problem => problem.message.includes('has no attributes'))).toBe(true)
    expect(JSON.stringify(clientCommande)).toBe(snapshot)
  })
  it('ne change que les commentaires et descriptions du code généré', () => {
    const program = (code: string) => code.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '').replace(/public function getDescription\(\): string\s*\{[^}]*\}/g, '').trim()
    for (const framework of ['laravel', 'symfony'] as const) {
      setLanguage('fr')
      const french = generateFiles(framework, clientCommande, mcdToMld(clientCommande), DEFAULT_MPD_SETTINGS)
      setLanguage('en')
      const englishFiles = generateFiles(framework, clientCommande, mcdToMld(clientCommande), DEFAULT_MPD_SETTINGS)
      expect(englishFiles.map(file => file.path)).toEqual(french.map(file => file.path))
      englishFiles.forEach((file, index) => expect(program(file.content)).toBe(program(french[index]!.content)))
    }
  })
  it('traduit uniquement la création d’un nouvel exemple', () => {
    const original = JSON.stringify(exampleMcd)
    setLanguage('en')
    const example = builtInExample()
    expect(example.name).toContain('Example')
    expect(example.state.mcd.entities[0]?.name).toBe('Customer')
    expect(example.state.mcd.properties[0]?.type).toBe('entier')
    expect(JSON.stringify(exampleMcd)).toBe(original)
  })
  it('réordonne les textes riches en conservant l’échappement React', () => {
    setLanguage('en')
    const result = renderToStaticMarkup(createElement(Translated, { source: "Une {0} est un fichier qui crée les tables. Une commande le joue, et la base se construit toute seule, à l'identique partout.", values: ['<script>alert(1)</script>'] }))
    expect(result.startsWith('A ')).toBe(true)
    expect(result).not.toContain('<script>')
    expect(result).toContain('&lt;script&gt;')
  })
})
