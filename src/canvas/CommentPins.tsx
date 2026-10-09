import { useEffect, useRef } from 'react'
import { useStore, ViewportPortal } from '@xyflow/react'
import type { CommentPosition } from '../lib/commentsApi'

export interface CommentPin {
  id: string
  /** Rang dans le fil : c'est le texte de la bulle quand elle est ouverte. */
  index: number
  position: CommentPosition
  label: string
  resolved: boolean
}

interface CommentPinsProps {
  pins: CommentPin[]
  onOpen: (commentId: string) => void
  /** Bulle à montrer et à focaliser. Le jeton rejoue un même identifiant. */
  revealed: { id: string; nonce: number } | null
  /** Un geste est en cours sur la zone : les bulles laissent passer. */
  muted: boolean
}

/**
 * Les bulles de commentaires, posées dans le repère du modèle : elles
 * restent sur leur point au zoom et au déplacement, et gardent leur
 * taille à l'écran, comme dans un outil de maquette.
 *
 * Le calque entier est transparent aux pointeurs ; seuls les boutons
 * reçoivent le clic. Sans cela il volerait chaque geste destiné à un
 * nœud. Pendant un geste d'outil, il devient transparent en entier.
 */
export function CommentPins({ pins, onOpen, revealed, muted }: CommentPinsProps) {
  const zoom = useStore((state) => state.transform[2])
  const buttons = useRef(new Map<string, HTMLButtonElement>())

  useEffect(() => {
    if (revealed === null) {
      return
    }
    buttons.current.get(revealed.id)?.focus()
  }, [revealed])

  if (pins.length === 0) {
    return null
  }

  return (
    <ViewportPortal>
      <div
        className="pointer-events-none absolute"
        style={{ left: 0, top: 0, width: 1, height: 1, zIndex: 1001 }}
      >
        {pins.map((pin) => (
          <button
            key={pin.id}
            type="button"
            ref={(node) => {
              if (node) buttons.current.set(pin.id, node)
              else buttons.current.delete(pin.id)
            }}
            onClick={() => onOpen(pin.id)}
            aria-label={pin.label}
            className={`nodrag nopan absolute flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold shadow-soft ${
              pin.resolved
                ? 'border-dashed border-line-strong bg-surface text-ink-soft opacity-60'
                : 'border-transparent bg-accent text-on-accent'
            }`}
            style={{
              // L'ancre suit le modèle, la bulle garde sa taille à l'écran.
              transform: `translate(${pin.position.x}px, ${pin.position.y}px) scale(${1 / zoom}) translate(-50%, -100%)`,
              pointerEvents: muted ? 'none' : 'auto',
            }}
          >
            {/* Le texte porte l'état : un rang, ou une coche quand c'est réglé. */}
            {pin.resolved ? '✓' : pin.index + 1}
          </button>
        ))}
      </div>
    </ViewportPortal>
  )
}
