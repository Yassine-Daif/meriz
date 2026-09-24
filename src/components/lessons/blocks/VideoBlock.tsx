import { resolveVideo } from '../../../lib/videoEmbed'
import { ExternalLink } from './ExternalLink'

interface VideoBlockProps {
  url: string
}

/**
 * Vidéo d'un cours. Seuls les hébergeurs reconnus sont intégrés, et
 * l'adresse du lecteur est reconstruite par videoEmbed à partir du seul
 * identifiant : l'adresse saisie n'atteint jamais le src de l'iframe.
 * Tout le reste devient un lien.
 */
export function VideoBlock({ url }: VideoBlockProps) {
  const embed = resolveVideo(url)

  if (!embed) {
    return (
      <p className="text-sm text-ink">
        <ExternalLink url={url} label={url} />
      </p>
    )
  }

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface-soft">
      <div className="relative aspect-video">
        <iframe
          src={embed.embedUrl}
          title={`Vidéo ${embed.providerLabel}`}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation"
          allowFullScreen
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>
    </div>
  )
}
