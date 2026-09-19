import { useSyncExternalStore } from 'react'
import { themeStore } from './theme'
import type { ThemeState } from './theme'

/** Thème courant (préférence et thème effectif), partagé par toute l'interface. */
export function useTheme(): ThemeState {
  return useSyncExternalStore(themeStore.subscribe, themeStore.getState, themeStore.getState)
}
