/**
 * Encodage d'un enregistrement en WAV, avec ce que fournit le navigateur.
 *
 * Pourquoi cette conversion : MediaRecorder produit un conteneur WebM ou
 * MP4, que le serveur reconnaît comme de la vidéo et refuse, puisqu'il
 * lit le type réel dans les octets et n'accepte que des conteneurs
 * audio. Un WAV est reconnu sans ambiguïté. Le son est donc décodé par
 * l'API audio du navigateur, ramené en mono, puis réécrit en WAV.
 *
 * Le WAV n'est pas compressé : en mono à 22 050 Hz sur 16 bits, environ
 * 44 Ko par seconde, soit près de six minutes sous la limite du serveur.
 */

/** Débit de sortie : la voix parlée n'a pas besoin de mieux. */
export const WAV_SAMPLE_RATE = 22_050

/** Écrit un WAV mono 16 bits à partir d'échantillons entre -1 et 1. */
export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const bytes = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(bytes)
  const ascii = (at: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(at + index, text.charCodeAt(index))
    }
  }

  ascii(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  view.setUint32(16, 16, true) // taille du bloc de format
  view.setUint16(20, 1, true) // PCM non compressé
  view.setUint16(22, 1, true) // un seul canal
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // octets par seconde
  view.setUint16(32, 2, true) // octets par échantillon
  view.setUint16(34, 16, true) // bits par échantillon
  ascii(36, 'data')
  view.setUint32(40, samples.length * 2, true)

  for (let index = 0; index < samples.length; index += 1) {
    const value = samples[index] ?? 0
    const clamped = value < -1 ? -1 : value > 1 ? 1 : value
    view.setInt16(44 + index * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true)
  }

  return new Blob([bytes], { type: 'audio/wav' })
}

/**
 * Convertit un enregistrement du navigateur en fichier WAV prêt à
 * envoyer. Lève si le son est illisible.
 */
export async function toWavFile(recorded: Blob, name = 'enregistrement.wav'): Promise<File> {
  const source = await recorded.arrayBuffer()
  const context = new AudioContext()
  let decoded: AudioBuffer
  try {
    decoded = await context.decodeAudioData(source)
  } finally {
    void context.close()
  }

  // Le rendu hors écran ramène le son en mono au débit voulu.
  const frames = Math.max(1, Math.floor(decoded.duration * WAV_SAMPLE_RATE))
  const offline = new OfflineAudioContext(1, frames, WAV_SAMPLE_RATE)
  const player = offline.createBufferSource()
  player.buffer = decoded
  player.connect(offline.destination)
  player.start()
  const rendered = await offline.startRendering()

  return new File([encodeWav(rendered.getChannelData(0), WAV_SAMPLE_RATE)], name, { type: 'audio/wav' })
}
