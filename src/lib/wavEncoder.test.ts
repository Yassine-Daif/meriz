import { describe, expect, it } from 'vitest'
import { encodeWav, WAV_SAMPLE_RATE } from './wavEncoder'

/** Relit l'en-tête écrit, comme le ferait un lecteur ou le serveur. */
async function header(blob: Blob) {
  const view = new DataView(await blob.arrayBuffer())
  const ascii = (at: number, length: number) =>
    String.fromCharCode(...Array.from({ length }, (_, index) => view.getUint8(at + index)))
  return {
    riff: ascii(0, 4),
    wave: ascii(8, 4),
    fmt: ascii(12, 4),
    format: view.getUint16(20, true),
    channels: view.getUint16(22, true),
    sampleRate: view.getUint32(24, true),
    bitsPerSample: view.getUint16(34, true),
    data: ascii(36, 4),
    dataSize: view.getUint32(40, true),
    declaredSize: view.getUint32(4, true),
    sample: (index: number) => view.getInt16(44 + index * 2, true),
  }
}

describe('écriture d’un fichier WAV', () => {
  it('écrit un en-tête que tout lecteur reconnaît', async () => {
    const wav = encodeWav(new Float32Array(100), WAV_SAMPLE_RATE)
    const read = await header(wav)

    expect(read.riff).toBe('RIFF')
    expect(read.wave).toBe('WAVE')
    expect(read.fmt).toBe('fmt ')
    expect(read.data).toBe('data')
    // PCM non compressé, un seul canal, 16 bits : le format le plus sûr.
    expect(read.format).toBe(1)
    expect(read.channels).toBe(1)
    expect(read.bitsPerSample).toBe(16)
    expect(read.sampleRate).toBe(WAV_SAMPLE_RATE)
    expect(wav.type).toBe('audio/wav')
  })

  it('annonce les bonnes tailles', async () => {
    const wav = encodeWav(new Float32Array(1000), WAV_SAMPLE_RATE)
    const read = await header(wav)

    expect(wav.size).toBe(44 + 2000)
    expect(read.dataSize).toBe(2000)
    expect(read.declaredSize).toBe(wav.size - 8)
  })

  it('convertit les échantillons et borne les débordements', async () => {
    const wav = encodeWav(new Float32Array([0, 1, -1, 2, -2, 0.5]), WAV_SAMPLE_RATE)
    const read = await header(wav)

    expect(read.sample(0)).toBe(0)
    expect(read.sample(1)).toBe(32767)
    expect(read.sample(2)).toBe(-32768)
    // Au-delà des bornes, on sature au lieu de replier le signal.
    expect(read.sample(3)).toBe(32767)
    expect(read.sample(4)).toBe(-32768)
    expect(read.sample(5)).toBe(16383)
  })

  it('accepte un enregistrement vide sans casser', async () => {
    const wav = encodeWav(new Float32Array(0), WAV_SAMPLE_RATE)

    expect(wav.size).toBe(44)
    expect((await header(wav)).dataSize).toBe(0)
  })
})
