import { useEffect, useRef, useState } from 'react'
import { toWavFile } from '../../lib/wavEncoder'
import { Button } from '../ui/Button'

interface VoiceRecorderProps {
  /** Enregistrement retenu par le prof, prêt à être envoyé. */
  onRecorded: (file: File) => void
  disabled?: boolean
}

/**
 * Enregistrement de la voix, avec ce que fournit le navigateur, sans
 * aucune librairie : getUserMedia pour le micro, MediaRecorder pour la
 * piste. Le prof écoute, recommence s'il veut, puis envoie.
 *
 * Le micro est relâché dès l'arrêt et au démontage : aucune piste ne
 * reste ouverte, aucun voyant ne reste allumé.
 *
 * Le navigateur enregistre dans un conteneur WebM ou MP4, que le serveur
 * reconnaît comme de la vidéo et refuse. La piste retenue est donc
 * réécrite en WAV avant l'envoi (voir wavEncoder.ts).
 */

/** Formats d'enregistrement, du plus courant au plus rare. */
const CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']

function supportedType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null
  for (const type of CANDIDATES) {
    if (MediaRecorder.isTypeSupported(type)) return type
  }
  // Certains navigateurs enregistrent sans qu'on précise le format.
  return ''
}

/** « 1:07 » */
function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

type Phase = 'idle' | 'recording' | 'recorded'

export function VoiceRecorder({ onRecorded, disabled = false }: VoiceRecorderProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const [converting, setConverting] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordedRef = useRef<Blob | null>(null)
  const previewRef = useRef<string | null>(null)

  const releaseMicrophone = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  const clearPreview = () => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current)
      previewRef.current = null
    }
    setPreview(null)
  }

  // Démontage en cours d'enregistrement : on coupe tout.
  useEffect(
    () => () => {
      recorderRef.current?.stop()
      releaseMicrophone()
      if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    },
    [],
  )

  useEffect(() => {
    if (phase !== 'recording') return
    const tick = setInterval(() => setSeconds((value) => value + 1), 1000)
    return () => clearInterval(tick)
  }, [phase])

  const start = async () => {
    setError(null)
    clearPreview()
    recordedRef.current = null
    const type = supportedType()
    if (type === null || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError("Ce navigateur ne sait pas enregistrer le son. Envoyez plutôt un fichier audio.")
      return
    }
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (cause) {
      const name = cause instanceof DOMException ? cause.name : ''
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setError(
          "Le micro a été refusé. Autorisez-le dans votre navigateur, puis réessayez, ou envoyez un fichier audio.",
        )
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setError('Aucun micro détecté sur cet appareil. Envoyez plutôt un fichier audio.')
      } else {
        setError("Le micro n'a pas pu démarrer. Envoyez plutôt un fichier audio.")
      }
      return
    }
    streamRef.current = stream
    chunksRef.current = []
    const recorder = type === '' ? new MediaRecorder(stream) : new MediaRecorder(stream, { mimeType: type })
    recorderRef.current = recorder
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data)
    }
    recorder.onstop = () => {
      releaseMicrophone()
      const mime = recorder.mimeType === '' ? 'audio/webm' : recorder.mimeType
      const blob = new Blob(chunksRef.current, { type: mime })
      recordedRef.current = blob
      const url = URL.createObjectURL(blob)
      previewRef.current = url
      setPreview(url)
      setPhase('recorded')
    }
    setSeconds(0)
    setPhase('recording')
    recorder.start()
  }

  const stop = () => {
    recorderRef.current?.stop()
    recorderRef.current = null
  }

  const keep = async () => {
    const recorded = recordedRef.current
    if (!recorded || converting) return
    setConverting(true)
    setError(null)
    let file: File
    try {
      file = await toWavFile(recorded)
    } catch {
      setConverting(false)
      setError("Cet enregistrement n'a pas pu être préparé. Recommencez, ou envoyez un fichier audio.")
      return
    }
    setConverting(false)
    clearPreview()
    recordedRef.current = null
    setPhase('idle')
    setSeconds(0)
    onRecorded(file)
  }

  const again = () => {
    clearPreview()
    recordedRef.current = null
    setPhase('idle')
    setSeconds(0)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {phase === 'idle' && (
          <Button variant="secondary" onClick={() => void start()} disabled={disabled}>
            <span aria-hidden="true">🎙</span>
            Enregistrer ma voix
          </Button>
        )}

        {phase === 'recording' && (
          <>
            <Button variant="danger" onClick={stop}>
              <span aria-hidden="true">■</span>
              Arrêter
            </Button>
            <p role="status" aria-live="polite" className="text-sm font-medium text-ink">
              Enregistrement en cours, {formatDuration(seconds)}
            </p>
          </>
        )}

        {phase === 'recorded' && (
          <>
            <Button
              variant="primary"
              onClick={() => void keep()}
              disabled={disabled || converting}
              loading={converting}
              loadingLabel="Préparation…"
            >
              Utiliser cet enregistrement
            </Button>
            <Button variant="ghost" onClick={again} disabled={converting}>
              Recommencer
            </Button>
          </>
        )}
      </div>

      {preview && (
        <audio controls src={preview} aria-label="Écouter l'enregistrement" className="w-full max-w-md" />
      )}

      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          <span aria-hidden="true">✕ </span>
          {error}
        </p>
      )}
    </div>
  )
}
