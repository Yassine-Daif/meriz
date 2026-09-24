import { parseWebUrl } from '../../../lib/videoEmbed'

interface ExternalLinkProps {
  url: string
  label: string
}

/**
 * Lien vers l'extérieur. Une adresse qui n'est pas en http ou https
 * s'affiche en texte, sans lien : on n'ouvre jamais un schéma inconnu.
 */
export function ExternalLink({ url, label }: ExternalLinkProps) {
  const safe = parseWebUrl(url)
  const text = label.trim() === '' ? url : label

  if (!safe) {
    return <span className="text-ink-soft">{text}</span>
  }

  return (
    <a
      href={safe.href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-accent-ink underline decoration-from-font underline-offset-2"
    >
      {text}
      <span className="sr-only"> (nouvel onglet)</span>
    </a>
  )
}
