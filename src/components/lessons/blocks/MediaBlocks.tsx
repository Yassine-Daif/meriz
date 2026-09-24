import type { ApiClient } from '../../../lib/apiClient'
import { useMediaUrl } from '../../../lib/useMediaUrl'

interface MediaBlockProps {
  client: ApiClient
  lessonId: string
  /** Fichier du bloc, ou null quand il n'en a pas encore. */
  mediaId: string | null
}

/** Message discret : un fichier manquant ne casse pas la page. */
function Placeholder({ text, alert = false }: { text: string; alert?: boolean }) {
  return (
    <p
      role={alert ? 'alert' : 'status'}
      className={`rounded-card border border-dashed border-line-strong bg-surface-soft p-4 text-sm ${
        alert ? 'text-danger' : 'text-ink-soft'
      }`}
    >
      {alert && <span aria-hidden="true">✕ </span>}
      {text}
    </p>
  )
}

/** Image d'un cours, avec sa description pour l'accessibilité. */
export function ImageBlock({ client, lessonId, mediaId, alt }: MediaBlockProps & { alt: string }) {
  const media = useMediaUrl(client, lessonId, mediaId)

  if (mediaId === null) {
    return <Placeholder text="Aucune image choisie pour l'instant." />
  }
  if (media.loading) {
    return <Placeholder text="Chargement de l'image…" />
  }
  if (!media.url) {
    return <Placeholder alert text={media.error ?? "Cette image n'a pas pu être chargée."} />
  }
  return (
    <img
      src={media.url}
      alt={alt}
      className="block h-auto max-w-full rounded-card border border-line bg-surface-soft"
    />
  )
}

/** Piste audio d'un cours, dans le lecteur du navigateur. */
export function AudioBlock({ client, lessonId, mediaId, label }: MediaBlockProps & { label: string }) {
  const media = useMediaUrl(client, lessonId, mediaId)

  if (mediaId === null) {
    return <Placeholder text="Aucun audio choisi pour l'instant." />
  }
  if (media.loading) {
    return <Placeholder text="Chargement de l'audio…" />
  }
  if (!media.url) {
    return <Placeholder alert text={media.error ?? "Cet audio n'a pas pu être chargé."} />
  }
  return (
    <div className="rounded-card border border-line bg-surface-soft p-3">
      {label.trim() !== '' && <p className="mb-2 text-sm font-medium text-ink">{label}</p>}
      <audio
        controls
        src={media.url}
        aria-label={label.trim() === '' ? 'Piste audio du cours' : label}
        className="w-full"
      />
    </div>
  )
}
