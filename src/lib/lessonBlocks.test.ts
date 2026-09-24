import { describe, expect, it } from 'vitest'
import {
  BLOCK_TYPES,
  blockLabel,
  emptyBlock,
  mediaIdOf,
  moveBlock,
  parseBlocks,
  removeBlock,
  replaceBlock,
  serializeBlocks,
} from './lessonBlocks'
import type { LessonBlock } from './lessonBlocks'

/** Page couvrant les six types, telle que le serveur la garde. */
const page = JSON.stringify([
  { type: 'heading', text: 'Les cardinalités' },
  { type: 'text', text: 'Un livre a un auteur.\nUn auteur écrit des livres.' },
  { type: 'link', url: 'https://exemple.fr', label: 'Fiche' },
  { type: 'video', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
  { type: 'image', media_id: '01MED', alt: 'Schéma du prêt' },
  { type: 'audio', media_id: '01AUD', label: 'Explication' },
])

describe('lecture de la page', () => {
  it('lit les six types, et traduit media_id', () => {
    const blocks = parseBlocks(page)

    expect(blocks.map((block) => block.type)).toEqual(['heading', 'text', 'link', 'video', 'image', 'audio'])
    expect(blocks[1]).toEqual({ type: 'text', text: 'Un livre a un auteur.\nUn auteur écrit des livres.' })
    expect(blocks[2]).toEqual({ type: 'link', url: 'https://exemple.fr', label: 'Fiche' })
    expect(blocks[4]).toEqual({ type: 'image', mediaId: '01MED', alt: 'Schéma du prêt' })
    expect(blocks[5]).toEqual({ type: 'audio', mediaId: '01AUD', label: 'Explication' })
  })

  it('ignore ce qu’elle ne sait pas lire, sans jamais lever', () => {
    expect(parseBlocks('pas du json')).toEqual([])
    expect(parseBlocks('{}')).toEqual([])
    expect(parseBlocks('123')).toEqual([])
    expect(parseBlocks('[]')).toEqual([])
    expect(
      parseBlocks(JSON.stringify([{ type: 'inconnu', text: 'x' }, null, 42, { text: 'sans type' }, { type: 'text', text: 'ok' }])),
    ).toEqual([{ type: 'text', text: 'ok' }])
  })

  it('remplace un champ manquant par du vide', () => {
    expect(parseBlocks(JSON.stringify([{ type: 'heading' }]))).toEqual([{ type: 'heading', text: '' }])
    expect(parseBlocks(JSON.stringify([{ type: 'image' }]))).toEqual([{ type: 'image', mediaId: '', alt: '' }])
    expect(parseBlocks(JSON.stringify([{ type: 'link', url: 42 }]))).toEqual([{ type: 'link', url: '', label: '' }])
  })

  it('refait le chemin inverse sans rien perdre', () => {
    const blocks = parseBlocks(page)

    expect(parseBlocks(serializeBlocks(blocks))).toEqual(blocks)
    // Le JSON enregistré reste en snake_case, comme le reste de l'API.
    expect(serializeBlocks(blocks)).toContain('"media_id":"01MED"')
    expect(serializeBlocks(blocks)).not.toContain('mediaId')
  })
})

describe('blocs neufs', () => {
  it('crée un bloc vide de chaque type, et sait le nommer', () => {
    for (const type of BLOCK_TYPES) {
      const block = emptyBlock(type)
      expect(block.type).toBe(type)
      expect(blockLabel(type).length).toBeGreaterThan(2)
    }
    expect(emptyBlock('audio')).toEqual({ type: 'audio', mediaId: '', label: '' })
  })

  it('dit quel fichier porte un bloc, et null quand il n’en a pas', () => {
    expect(mediaIdOf({ type: 'image', mediaId: '01MED', alt: 'x' })).toBe('01MED')
    expect(mediaIdOf({ type: 'image', mediaId: '', alt: '' })).toBeNull()
    expect(mediaIdOf({ type: 'audio', mediaId: '01AUD', label: '' })).toBe('01AUD')
    expect(mediaIdOf({ type: 'text', text: 'x' })).toBeNull()
  })
})

describe('ordre de la page', () => {
  const trois: LessonBlock[] = [
    { type: 'heading', text: 'A' },
    { type: 'heading', text: 'B' },
    { type: 'heading', text: 'C' },
  ]
  const noms = (blocks: readonly LessonBlock[]) => blocks.map((block) => (block.type === 'heading' ? block.text : '?'))

  it('monte et descend un bloc', () => {
    expect(noms(moveBlock(trois, 1, 'up'))).toEqual(['B', 'A', 'C'])
    expect(noms(moveBlock(trois, 1, 'down'))).toEqual(['A', 'C', 'B'])
  })

  it('ne bouge rien aux extrémités ni hors des bornes', () => {
    expect(noms(moveBlock(trois, 0, 'up'))).toEqual(['A', 'B', 'C'])
    expect(noms(moveBlock(trois, 2, 'down'))).toEqual(['A', 'B', 'C'])
    expect(noms(moveBlock(trois, -1, 'down'))).toEqual(['A', 'B', 'C'])
    expect(noms(moveBlock(trois, 9, 'up'))).toEqual(['A', 'B', 'C'])
  })

  it('retire et remplace un bloc sans toucher aux autres', () => {
    expect(noms(removeBlock(trois, 1))).toEqual(['A', 'C'])
    expect(noms(removeBlock(trois, 9))).toEqual(['A', 'B', 'C'])
    expect(noms(replaceBlock(trois, 0, { type: 'heading', text: 'Z' }))).toEqual(['Z', 'B', 'C'])
  })

  it('ne modifie jamais la page reçue', () => {
    moveBlock(trois, 0, 'down')
    removeBlock(trois, 0)

    expect(noms(trois)).toEqual(['A', 'B', 'C'])
  })
})
