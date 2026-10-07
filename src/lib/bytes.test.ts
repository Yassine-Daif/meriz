import { describe, expect, it } from 'vitest'
import { fromBase64, toBase64 } from './bytes'

describe('octets et base64', () => {
  it('fait l’aller-retour d’un contenu quelconque', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 255])
    expect(fromBase64(toBase64(bytes))).toEqual(bytes)
  })

  it('accepte le vide', () => {
    expect(toBase64(new Uint8Array())).toBe('')
    expect(fromBase64('')).toEqual(new Uint8Array())
  })

  it('n’abîme aucune des 256 valeurs d’octet', () => {
    const bytes = new Uint8Array(256)
    for (let value = 0; value < 256; value += 1) {
      bytes[value] = value
    }
    expect(fromBase64(toBase64(bytes))).toEqual(bytes)
  })

  it('tient un gros contenu, par tranches', () => {
    const bytes = new Uint8Array(200_000)
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = (index * 7) % 256
    }
    const retour = fromBase64(toBase64(bytes))
    expect(retour.length).toBe(bytes.length)
    expect(retour).toEqual(bytes)
  })
})
