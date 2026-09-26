import { describe, expect, it } from 'vitest'
import { normalizeEchoConfig } from './echoConfig'

const complet = { key: 'cle-publique', host: '127.0.0.1', port: '8080', scheme: 'http' }

describe('réglages du direct', () => {
  it('lit des réglages complets', () => {
    expect(normalizeEchoConfig(complet)).toEqual({
      key: 'cle-publique',
      host: '127.0.0.1',
      port: 8080,
      scheme: 'http',
    })
  })

  it('accepte les espaces autour des valeurs', () => {
    expect(normalizeEchoConfig({ ...complet, key: '  cle-publique  ', scheme: ' HTTP ' })).toEqual({
      key: 'cle-publique',
      host: '127.0.0.1',
      port: 8080,
      scheme: 'http',
    })
  })

  it('refuse un réglage à moitié rempli', () => {
    expect(normalizeEchoConfig({})).toBeNull()
    expect(normalizeEchoConfig({ ...complet, key: '' })).toBeNull()
    expect(normalizeEchoConfig({ ...complet, key: '   ' })).toBeNull()
    expect(normalizeEchoConfig({ ...complet, host: undefined })).toBeNull()
  })

  it('refuse un port qui n’en est pas un', () => {
    expect(normalizeEchoConfig({ ...complet, port: 'huit-mille' })).toBeNull()
    expect(normalizeEchoConfig({ ...complet, port: '0' })).toBeNull()
    expect(normalizeEchoConfig({ ...complet, port: '-1' })).toBeNull()
    expect(normalizeEchoConfig({ ...complet, port: '70000' })).toBeNull()
    expect(normalizeEchoConfig({ ...complet, port: '8080.5' })).toBeNull()
  })

  it('refuse un schéma inconnu', () => {
    expect(normalizeEchoConfig({ ...complet, scheme: 'ws' })).toBeNull()
    expect(normalizeEchoConfig({ ...complet, scheme: 'ftp' })).toBeNull()
  })

  it('choisit le port habituel du schéma quand il n’est pas donné', () => {
    expect(normalizeEchoConfig({ key: 'k', host: 'direct.exemple.fr', scheme: 'https' })?.port).toBe(443)
    expect(normalizeEchoConfig({ key: 'k', host: 'direct.exemple.fr', scheme: 'http', port: '' })?.port).toBe(80)
  })

  it('suppose le chiffrement quand le schéma n’est pas précisé', () => {
    expect(normalizeEchoConfig({ key: 'k', host: 'direct.exemple.fr' })).toEqual({
      key: 'k',
      host: 'direct.exemple.fr',
      port: 443,
      scheme: 'https',
    })
  })
})
