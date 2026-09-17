import { describe, expect, it } from 'vitest'
import { normalizeApiUrl } from './apiConfig'

describe("normalizeApiUrl, adresse du serveur", () => {
  it('accepte une origine http ou https et retire la barre finale', () => {
    expect(normalizeApiUrl('http://127.0.0.1:8000')).toBe('http://127.0.0.1:8000')
    expect(normalizeApiUrl('https://api.meriz.fr/')).toBe('https://api.meriz.fr')
    expect(normalizeApiUrl('  https://exemple.fr/meriz/  ')).toBe('https://exemple.fr/meriz')
  })

  it('refuse une valeur absente, vide ou invalide', () => {
    expect(normalizeApiUrl(undefined)).toBeNull()
    expect(normalizeApiUrl('')).toBeNull()
    expect(normalizeApiUrl('   ')).toBeNull()
    expect(normalizeApiUrl('pas une adresse')).toBeNull()
    expect(normalizeApiUrl('ftp://exemple.fr')).toBeNull()
    expect(normalizeApiUrl(8000)).toBeNull()
  })
})
