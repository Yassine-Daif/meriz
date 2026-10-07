import { describe, expect, it } from 'vitest'
import { concatFiles, filesToMarkdown, FRAMEWORKS, generateFiles } from './codegen'
import type { Mcd } from './mcd'
import { mcdToMld } from './mld'
import { DEFAULT_MPD_SETTINGS } from './mpd'
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

const FIXTURES: readonly (readonly [string, Mcd])[] = [
  ['clientCommande', clientCommande],
  ['clientCommandeOptionnel', clientCommandeOptionnel],
  ['inscription', inscription],
  ['tutorat', tutorat],
  ['vols', vols],
  ['occupation', occupation],
  ['livraisonTernaire', livraisonTernaire],
  ['entiteSansIdentifiant', entiteSansIdentifiant],
  ['vide', { properties: [], entities: [], associations: [] }],
]

const filesFor = (framework: 'laravel' | 'symfony', mcd: Mcd) =>
  generateFiles(framework, mcd, mcdToMld(mcd), DEFAULT_MPD_SETTINGS)

describe('génération de code, solidité sur tous les modèles', () => {
  it('offre les deux frameworks', () => {
    expect(FRAMEWORKS.map((framework) => framework.id)).toEqual(['laravel', 'symfony'])
    expect(FRAMEWORKS.map((framework) => framework.label)).toEqual(['Laravel', 'Symfony'])
  })

  for (const framework of ['laravel', 'symfony'] as const) {
    for (const [nom, mcd] of FIXTURES) {
      it(`tient debout sur ${nom} en ${framework}`, () => {
        const files = filesFor(framework, mcd)

        const paths = files.map((file) => file.path)
        expect(new Set(paths).size).toBe(paths.length)
        for (const file of files) {
          expect(file.content.startsWith('<?php\n')).toBe(true)
          // Un trou dans le générateur se verrait ici.
          expect(file.content).not.toContain('undefined')
          expect(file.content).not.toContain('NaN')
          expect(file.content).not.toContain('[object')
          // Règle du dépôt : aucun tiret long, pas même dans le code généré.
          expect(file.content).not.toContain(String.fromCharCode(0x2014))
        }
      })
    }
  }

  it('rend deux fois le même texte, donc se compare d’une exécution à l’autre', () => {
    for (const [, mcd] of FIXTURES) {
      for (const framework of ['laravel', 'symfony'] as const) {
        expect(filesFor(framework, mcd)).toEqual(filesFor(framework, mcd))
      }
    }
  })

  it('ne produit rien d’un modèle vide', () => {
    expect(filesFor('laravel', { properties: [], entities: [], associations: [] })).toEqual([])
    expect(filesFor('symfony', { properties: [], entities: [], associations: [] })).toEqual([])
  })
})

describe('génération de code, copie et export', () => {
  it('annonce chaque fichier dans le texte de copie', () => {
    const files = filesFor('laravel', clientCommande)
    const texte = concatFiles(files)

    for (const file of files) {
      expect(texte).toContain(`/* ===== ${file.path} ===== */`)
    }
    expect(texte).toContain('class Client extends Model')
  })

  it('écrit un Markdown avec un bloc php par fichier', () => {
    const files = filesFor('symfony', clientCommande)
    const markdown = filesToMarkdown(files, 'Symfony')

    expect(markdown.startsWith('# Symfony')).toBe(true)
    expect(markdown).toContain('### src/Entity/Client.php')
    expect(markdown.split('```php').length - 1).toBe(files.length)
  })
})
