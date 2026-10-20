import { useEffect } from 'react'
import type { RefObject } from 'react'
import { useMotion } from '../lib/useMotion'

/** Un fondu au changement de vue, sans déplacer ni remonter le schéma. */
export function useViewEntrance(ref: RefObject<HTMLElement | null>, view: string) {
  const { enabled } = useMotion()
  useEffect(() => {
    if (!enabled || !ref.current?.animate) return
    const animation = ref.current.animate([{ opacity: 0.82 }, { opacity: 1 }], {
      duration: 180, easing: 'ease-out',
    })
    return () => animation.cancel()
  }, [ref, view, enabled])
}
