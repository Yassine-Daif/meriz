import { useEffect, useState } from 'react'
import { ViewportPortal } from '@xyflow/react'
import type { CollabInk, RemotePresence } from '../model/collabProvider'
import type { Comment } from '../lib/commentsApi'

/** Annotations dans le repère du modèle, chez l'auteur comme chez ses partenaires. */
export function RemoteInk({ others, localInk, saved = [], hidden = false }: {
  others: RemotePresence[]; localInk?: CollabInk | null; saved?: Comment[]; hidden?: boolean
}) {
  const [now, setNow] = useState(Date.now)
  const inks = [localInk, ...others.map((other) => other.ink)].filter((ink): ink is CollabInk => !!ink)
  const timed = inks.some((ink) => (ink.strokes?.length ?? 0) > 0)
  useEffect(() => {
    if (!timed) return
    const timer = window.setInterval(() => setNow(Date.now()), 150)
    return () => window.clearInterval(timer)
  }, [timed])
  if (hidden) return null
  const traces = inks.flatMap((ink, index) => [
    ...(ink.points.length >= 2 ? [{ id: 'active-'+index, points: ink.points, saved: false }] : []),
    ...(ink.strokes ?? []).filter((stroke) => stroke.expiresAt > Math.max(now, Date.now())).map((stroke) => ({ ...stroke, saved: false })),
  ]).concat(saved.flatMap((comment) => comment.drawing ? [{ id: comment.id, points: comment.drawing, saved: true }] : []))
  if (traces.length === 0) return null
  return <ViewportPortal>
    <svg aria-hidden="true" data-ink-layer className="pointer-events-none absolute overflow-visible" style={{ left: 0, top: 0, width: 1, height: 1, zIndex: 998 }}>
      {traces.map((trace) => <g key={trace.id} data-ink-id={trace.id} data-ink-saved={trace.saved || undefined}>
        <polyline points={trace.points.map((point) => point.x+','+point.y).join(' ')} fill="none" stroke="var(--c-surface)" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <polyline points={trace.points.map((point) => point.x+','+point.y).join(' ')} fill="none" stroke="var(--c-danger-strong)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </g>)}
    </svg>
  </ViewportPortal>
}
