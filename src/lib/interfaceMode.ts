import type { ViewId } from '../components/views'

export type InterfaceMode = 'beginner' | 'complete'
export type UsageCategory = 'student' | 'teacher' | 'professional' | 'individual'
export function parseInterfaceMode(value: unknown): InterfaceMode | null {
  return value === 'beginner' || value === 'complete' ? value : null
}
export function parseUsageCategory(value: unknown): UsageCategory | null {
  return value === 'student' || value === 'teacher' || value === 'professional' || value === 'individual' ? value : null
}
export function recommendedMode(category: UsageCategory | null | undefined): InterfaceMode {
  return category === 'teacher' || category === 'professional' ? 'complete' : 'beginner'
}
export const BEGINNER_VIEWS: readonly ViewId[] = ['dictionnaire', 'mcd', 'mld', 'apprendre', 'apropos']
export function visibleViews(mode: InterfaceMode): readonly ViewId[] {
  return mode === 'beginner' ? BEGINNER_VIEWS : [...BEGINNER_VIEWS, 'mpd', 'sql', 'code']
}

const KEY = 'meriz-interface-mode'
let memory: InterfaceMode | null = null
const listeners = new Set<() => void>()
export function readLocalMode(): InterfaceMode | null {
  try { return parseInterfaceMode(localStorage.getItem(KEY)) ?? memory } catch { return memory }
}
export function setLocalMode(mode: InterfaceMode): void {
  memory = mode
  try { localStorage.setItem(KEY, mode) } catch { /* Le choix reste utilisable sans stockage. */ }
  listeners.forEach(listener => listener())
}
export function subscribeLocalMode(listener: () => void): () => void {
  listeners.add(listener); return () => { listeners.delete(listener) }
}
if (typeof window !== 'undefined') window.addEventListener('storage', event => {
  if (event.key === KEY || event.key === null) { memory = null; listeners.forEach(listener => listener()) }
})
