import { useEffect, useState } from 'react'

/**
 * Annonce polie pour les lecteurs d'écran seulement. Le texte est posé
 * après le montage : une zone live n'annonce que ce qui change.
 */
export function LiveAnnouncement({ message }: { message: string | null }) {
  const [text, setText] = useState('')
  useEffect(() => {
    setText(message ?? '')
  }, [message])
  return (
    <p role="status" aria-live="polite" className="sr-only">
      {text}
    </p>
  )
}
