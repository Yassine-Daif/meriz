import { useState } from 'react'
import type { ApiClient } from '../../lib/apiClient'
import { deleteLessonMedium, uploadLessonMedium } from '../../lib/lessonsApi'
import type { LessonMedium, MediumKind } from '../../lib/lessonsApi'
import { ImportFileButton } from '../ImportFileButton'
import { buttonClass } from '../ui/buttonClass'
import { VoiceRecorder } from './VoiceRecorder'

interface MediaFieldProps {
  client: ApiClient
  lessonId: string
  kind: MediumKind
  /** Fichier déjà choisi pour ce bloc, s'il y en a un. */
  medium: LessonMedium | null
  /** Fichier envoyé : l'appelant le pose dans le bloc et dans la liste. */
  onUploaded: (medium: LessonMedium) => void
  /** Fichier remplacé : l'ancien vient d'être supprimé du serveur. */
  onReplaced: (removedId: string) => void
}

const ACCEPT: Record<MediumKind, string> = {
  image: 'image/jpeg,image/png,image/webp',
  audio: 'audio/mpeg,audio/ogg,audio/wav,audio/mp4,audio/webm,.mp3,.ogg,.wav,.m4a',
}

const HINT: Record<MediumKind, string> = {
  image: 'JPEG, PNG ou WebP, 2 Mo au plus.',
  audio: 'MP3, OGG, WAV, M4A ou WebM, 16 Mo au plus.',
}

/** « 1,4 Mo » */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`
}

/**
 * Choix du fichier d'un bloc image ou audio. L'envoi passe par la couche
 * réseau ; le serveur vérifie le format sur le contenu réel, ses refus
 * sont affichés tels quels. Remplacer un fichier supprime l'ancien, pour
 * ne pas laisser de pièce jointe orpheline dans le cours.
 */
export function MediaField({ client, lessonId, kind, medium, onUploaded, onReplaced }: MediaFieldProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upload = async (file: File) => {
    if (busy) return
    setBusy(true)
    setError(null)
    const result = await uploadLessonMedium(client, lessonId, file)
    if (!result.ok) {
      setBusy(false)
      setError(result.error.fieldErrors.file?.[0] ?? result.error.message)
      return
    }
    const previous = medium
    onUploaded(result.value)
    if (previous) {
      // L'ancien fichier ne sert plus : il part, sinon il compte pour rien
      // dans le quota du cours et reste téléchargeable.
      await deleteLessonMedium(client, lessonId, previous.id)
      onReplaced(previous.id)
    }
    setBusy(false)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <ImportFileButton
          className={buttonClass({ variant: medium ? 'secondary' : 'primary', size: 'sm' })}
          accept={ACCEPT[kind]}
          onFile={(file) => void upload(file)}
        >
          {medium ? 'Remplacer le fichier' : kind === 'image' ? 'Choisir une image' : 'Envoyer un fichier audio'}
        </ImportFileButton>

        {kind === 'audio' && <VoiceRecorder onRecorded={(file) => void upload(file)} disabled={busy} />}

        <p role="status" aria-live="polite" className="text-sm text-ink-soft empty:hidden">
          {busy ? 'Envoi…' : ''}
        </p>
      </div>

      <p className="text-xs text-ink-soft">
        {medium ? `${medium.name}, ${formatSize(medium.size)}.` : HINT[kind]}
      </p>

      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          <span aria-hidden="true">✕ </span>
          {error}
        </p>
      )}
    </div>
  )
}
