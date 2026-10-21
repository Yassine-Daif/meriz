import { useCallback, useEffect, useRef, useState } from 'react'
import type { CollabInk } from '../model/collabProvider'
import { registerUpdateGuard } from '../lib/updateSafety'
import type { InkPoint } from '../model/inkTrace'

export type InkDuration = 'short' | 'long' | 'saved'
type Trail = NonNullable<CollabInk['strokes']>[number]

/** Présence pour les gestes, API des commentaires pour les seuls traits conservés. */
export function useAnnotationInk(options: {
  enabled: boolean
  onPublish?: (ink: CollabInk | null) => void
  onSave: (points: InkPoint[]) => Promise<string | null>
}) {
  const { onPublish } = options
  const [duration, setDuration] = useState<InkDuration>('short')
  const [preview, setPreview] = useState<CollabInk | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const points = useRef<InkPoint[]>([])
  const trails = useRef<Trail[]>([])
  const pending = useRef(new Map<string, InkPoint[]>())
  const saving = useRef(new Set<string>())
  const current = useRef({ ...options, duration })
  current.current = { ...options, duration }
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const update = useCallback(() => {
    if (!alive.current) return
    const recent = trails.current.filter((stroke) => stroke.expiresAt > Date.now()).slice(-3)
    trails.current = recent
    setPreview(points.current.length < 2 && recent.length === 0 ? null : { points: points.current, strokes: recent })
  }, [])
  const clear = useCallback(() => { points.current = []; trails.current = []; update() }, [update])
  useEffect(() => { onPublish?.(preview) }, [preview, onPublish])
  useEffect(() => { if (!options.enabled) clear() }, [options.enabled, clear])
  const hasTrails = (preview?.strokes?.length ?? 0) > 0
  useEffect(() => {
    if (!hasTrails) return
    const timer = window.setInterval(() => {
      if (trails.current.some((stroke) => stroke.expiresAt <= Date.now())) update()
    }, 150)
    return () => window.clearInterval(timer)
  }, [hasTrails, update])
  const attempt = useCallback(async (id: string) => {
    const stroke = pending.current.get(id)
    if (!stroke || saving.current.has(id)) return
    saving.current.add(id)
    let failure: string | null
    try { failure = await current.current.onSave(stroke) } catch { failure = 'Connexion interrompue.' }
    saving.current.delete(id)
    if (!alive.current) return
    if (failure) setError('Trait non enregistré : '+failure+' Vous pouvez réessayer sans le redessiner.')
    else {
      pending.current.delete(id)
      trails.current = trails.current.filter((trail) => trail.id !== id)
      if (pending.current.size === 0) setError(null)
    }
    setPendingCount(pending.current.size)
    update()
  }, [update])
  const onStroke = useCallback((next: InkPoint[] | null) => {
    if (!current.current.enabled) return
    if (next !== null) {
      if (current.current.duration === 'saved' && pending.current.size >= 10) {
        setError('Dix traits attendent leur sauvegarde. Réessayez avant de continuer à dessiner.')
        return
      }
      points.current = next
      update()
      return
    }
    const completed = points.current
    points.current = []
    if (completed.length >= 2) {
      const id = crypto.randomUUID()
      const saved = current.current.duration === 'saved'
      // Trois traits, trente-deux points chacun : la présence reste sous la limite Reverb.
      const compact = completed.filter((_, index) => index % 2 === 0 || index === completed.length - 1).slice(-33)
      trails.current.push({ id, points: compact, expiresAt: Date.now() + (saved ? 20_000 : current.current.duration === 'long' ? 15_000 : 3000) })
      if (saved) {
        pending.current.set(id, completed)
        setPendingCount(pending.current.size)
        void attempt(id)
      }
    }
    update()
  }, [attempt, update])
  const retry = useCallback(async () => {
    for (const id of pending.current.keys()) await attempt(id)
  }, [attempt])
  useEffect(() => registerUpdateGuard(async () => {
    await retry()
    return pending.current.size === 0
  }), [retry])
  useEffect(() => {
    if (pendingCount === 0) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [pendingCount])
  return { duration, setDuration, preview, onStroke, clear, error, pendingCount, retry }
}
