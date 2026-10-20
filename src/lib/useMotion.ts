import { useSyncExternalStore } from 'react'
import { motionStore } from './motion'

export function useMotion() {
  return useSyncExternalStore(motionStore.subscribe, motionStore.getState, motionStore.getState)
}
