/**
 * Thème de l'interface : Système (par défaut), Clair ou Sombre.
 * La préférence est gardée dans le navigateur ; le thème effectif est
 * posé en data-theme sur <html>, que les tokens CSS lisent. Un script
 * dans index.html l'applique avant le premier rendu, sans flash.
 */

export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'meriz-theme'

/** Couleur de la barre du navigateur mobile, selon le thème (fond papier). */
const THEME_COLORS: Record<ResolvedTheme, string> = { light: '#f6f3ee', dark: '#121124' }

export function parseThemePreference(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system'
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === 'system') {
    return systemPrefersDark ? 'dark' : 'light'
  }
  return preference
}

function readStoredPreference(): ThemePreference {
  try {
    return parseThemePreference(localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    return 'system'
  }
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches === true
}

function applyTheme(theme: ResolvedTheme): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme])
}

export interface ThemeState {
  preference: ThemePreference
  resolved: ResolvedTheme
}

/**
 * Petit magasin partagé (sans React) : tous les composants lisent le même
 * thème, et suivent le système quand la préférence est « Système ».
 */
function createThemeStore() {
  let state: ThemeState = {
    preference: readStoredPreference(),
    resolved: resolveTheme(readStoredPreference(), systemPrefersDark()),
  }
  const listeners = new Set<() => void>()

  const update = (preference: ThemePreference) => {
    const next: ThemeState = { preference, resolved: resolveTheme(preference, systemPrefersDark()) }
    if (next.preference === state.preference && next.resolved === state.resolved) return
    state = next
    applyTheme(state.resolved)
    for (const listener of listeners) listener()
  }

  if (typeof window !== 'undefined' && window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      update(state.preference)
    })
  }

  return {
    getState: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    setPreference: (preference: ThemePreference) => {
      try {
        if (preference === 'system') localStorage.removeItem(THEME_STORAGE_KEY)
        else localStorage.setItem(THEME_STORAGE_KEY, preference)
      } catch {
        // Stockage indisponible : le choix vaut pour la session.
      }
      update(preference)
    },
  }
}

export const themeStore = createThemeStore()
