import { describe, expect, it } from 'vitest'
import { DEFAULT_MPD_SETTINGS } from '../model/mpd'
import { clientCommande } from '../model/testFixtures'
import { fileNameFor, nameFromFileName, parseModelFile, serializeModel } from './persistence'

const state = { mcd: clientCommande, layout: {} }

describe('format de fichier, nom du document', () => {
  it('conserve le nom du document entre export et réimportation', () => {
    const result = parseModelFile(serializeModel(state, DEFAULT_MPD_SETTINGS, 'Gestion des commandes'))
    expect(result.ok && result.name).toBe('Gestion des commandes')
  })

  it("ouvre un fichier sans nom (ancien format) avec un nom nul", () => {
    const text = serializeModel(state, DEFAULT_MPD_SETTINGS)
    expect(JSON.parse(text)).not.toHaveProperty('name')
    const result = parseModelFile(text)
    expect(result.ok && result.name).toBeNull()
  })

  it('ignore un nom vide ou mal typé sans refuser le fichier', () => {
    const file = JSON.parse(serializeModel(state, DEFAULT_MPD_SETTINGS, 'x'))
    file.name = '   '
    expect(parseModelFile(JSON.stringify(file))).toMatchObject({ ok: true, name: null })
    file.name = 42
    expect(parseModelFile(JSON.stringify(file))).toMatchObject({ ok: true, name: null })
  })
})

describe('noms de fichiers', () => {
  it("nomme le fichier exporté d'après le document, sans caractères interdits", () => {
    expect(fileNameFor('Gestion des commandes')).toBe('Gestion des commandes.meriz.json')
    expect(fileNameFor('TP 3 : a/b')).toBe('TP 3 - a-b.meriz.json')
    expect(fileNameFor('   ')).toBe('modele.meriz.json')
  })

  it('déduit le nom du document du nom de fichier importé', () => {
    expect(nameFromFileName('universite.meriz.json')).toBe('universite')
    expect(nameFromFileName('modele.JSON')).toBe('modele')
    expect(nameFromFileName('.json')).toBe('Document importé')
  })
})
