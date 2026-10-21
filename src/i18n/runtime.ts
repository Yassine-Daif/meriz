import { english as baseEnglish } from './en'
import { englishExtras } from './enExtras'
export const english = { ...baseEnglish, ...englishExtras }

export type Language = 'fr' | 'en'
export const LANGUAGE_KEY = 'meriz-language'
export function parseLanguage(value: unknown): Language | null { return value === 'fr' || value === 'en' ? value : null }
function initialLanguage(): Language {
  if (typeof document === 'undefined') return 'fr'
  let requested: Language | null = null
  try { requested = parseLanguage(new URL(location.href).searchParams.get('lang')) } catch { /* URL non disponible. */ }
  if (requested) {
    try { localStorage.setItem(LANGUAGE_KEY, requested) } catch { /* Le lien choisit la langue même sans stockage. */ }
    return requested
  }
  try {
    const saved = parseLanguage(localStorage.getItem(LANGUAGE_KEY))
    if (saved) return saved
  } catch { /* Préférence en mémoire pour cette session. */ }
  return typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('fr') ? 'fr' : 'en'
}
let language = initialLanguage()
const listeners = new Set<() => void>()
function applyLanguage() {
  if (typeof document === 'undefined') return
  document.documentElement.lang = language
  document.title = language === 'en' ? 'Meriz — Merise database modelling' : 'Meriz — Modélisation Merise'
}
export function getLanguage(): Language { return language }
export function localeTag(): string { return language === 'en' ? 'en-GB' : 'fr-FR' }
export function setLanguage(next: Language): void {
  if (!parseLanguage(next)) return
  try { localStorage.setItem(LANGUAGE_KEY, next) } catch { /* Préférence en mémoire. */ }
  if (next === language) return
  language = next
  applyLanguage()
  listeners.forEach(listener => listener())
}
export function subscribeLanguage(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener) } }
if (typeof window !== 'undefined') window.addEventListener('storage', event => {
  const next = parseLanguage(event.newValue)
  if (event.key === LANGUAGE_KEY && next && next !== language) { language = next; applyLanguage(); listeners.forEach(listener => listener()) }
})
applyLanguage()

/** Les valeurs restent des textes : aucune traduction n'est interprétée en HTML. */
export function translate(source: string, values: readonly unknown[] = [], locale: Language = language): string {
  const text = locale === 'en' && Object.hasOwn(english, source) ? english[source] : source
  return text.replace(/\{(\d+)\}/g, (match, index: string) => Number(index) < values.length ? String(values[Number(index)] ?? '') : match)
}
export const t = translate
export function isPlural(count: number): boolean { return language === 'en' ? count !== 1 : count > 1 }
