import { describe, expect, it } from 'vitest'
import {
  contrastRatio,
  DEFAULT_AVATAR_BG,
  formatContrast,
  normalizeHex,
  parseAvatarColor,
  READABLE_CONTRAST,
} from './color'

describe('couleurs hexadécimales', () => {
  it('normalise la casse et développe la forme courte', () => {
    expect(normalizeHex('#AABBCC')).toBe('#aabbcc')
    expect(normalizeHex('  #abc ')).toBe('#aabbcc')
    expect(normalizeHex('#1e1b4b')).toBe('#1e1b4b')
  })

  it('refuse ce qui ne ressemble pas à une couleur', () => {
    expect(normalizeHex('rouge')).toBeNull()
    expect(normalizeHex('1e1b4b')).toBeNull()
    expect(normalizeHex('#12345')).toBeNull()
    expect(normalizeHex(null)).toBeNull()
    expect(normalizeHex(42)).toBeNull()
  })

  it("retombe sur la valeur par défaut plutôt que d'échouer", () => {
    expect(parseAvatarColor('#FEE2E2', DEFAULT_AVATAR_BG)).toBe('#fee2e2')
    expect(parseAvatarColor(undefined, DEFAULT_AVATAR_BG)).toBe(DEFAULT_AVATAR_BG)
    expect(parseAvatarColor('bleu ciel', DEFAULT_AVATAR_BG)).toBe(DEFAULT_AVATAR_BG)
  })
})

describe('contraste', () => {
  it('donne 21 pour le noir sur blanc, et 1 pour deux couleurs identiques', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrastRatio('#4338ca', '#4338ca')).toBeCloseTo(1, 5)
  })

  it("ne dépend pas de l'ordre des deux couleurs", () => {
    expect(contrastRatio('#e0e7ff', '#1e1b4b')).toBeCloseTo(contrastRatio('#1e1b4b', '#e0e7ff'), 10)
  })

  it('juge la paire par défaut lisible, et une paire trop douce non lisible', () => {
    expect(contrastRatio(DEFAULT_AVATAR_BG, '#1e1b4b')).toBeGreaterThanOrEqual(READABLE_CONTRAST)
    expect(contrastRatio('#e0e7ff', '#f5f3ff')).toBeLessThan(READABLE_CONTRAST)
  })

  it('écrit le rapport en toutes lettres', () => {
    expect(formatContrast(12.06)).toBe('12,1 sur 1')
    expect(formatContrast(3)).toBe('3,0 sur 1')
  })
})
