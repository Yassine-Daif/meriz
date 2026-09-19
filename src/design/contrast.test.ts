import { describe, expect, it } from 'vitest'
import css from '../index.css?raw'

/**
 * Garde-fou d'accessibilité : chaque couple texte et fond employé par
 * l'interface atteint le niveau WCAG AA, en clair et en sombre. Les
 * valeurs sont lues dans index.css, la seule source des tokens.
 */

function tokensOf(block: string): Record<string, string> {
  const tokens: Record<string, string> = {}
  for (const match of block.matchAll(/--c-([a-z-]+):\s*(#[0-9a-f]{6})/gi)) {
    tokens[match[1] ?? ''] = (match[2] ?? '').toLowerCase()
  }
  return tokens
}

function blockAfter(selector: string): string {
  const start = css.indexOf(selector)
  if (start < 0) throw new Error(`bloc ${selector} introuvable dans index.css`)
  return css.slice(start, css.indexOf('}', start))
}

const light = tokensOf(blockAfter(':root {'))
const dark = tokensOf(blockAfter("[data-theme='dark'] {"))

function luminance(hex: string): number {
  const channels = (hex.replace('#', '').match(/../g) ?? []).map((h) => parseInt(h, 16) / 255)
  const [r = 0, g = 0, b = 0] = channels.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (high + 0.05) / (low + 0.05)
}

/** [texte ou trait, fond, minimum]. 4,5 pour le texte, 3 pour les contours et traits. */
const PAIRS: [string, string, number][] = [
  ['ink', 'shell', 4.5],
  ['ink', 'surface', 4.5],
  ['ink', 'surface-soft', 4.5],
  ['ink', 'canvas', 4.5],
  ['ink', 'accent-soft', 4.5],
  ['ink', 'warning-soft', 4.5],
  ['ink', 'danger-soft', 4.5],
  ['ink', 'sky-soft', 4.5],
  ['ink', 'sage-soft', 4.5],
  ['ink-soft', 'shell', 4.5],
  ['ink-soft', 'surface', 4.5],
  ['ink-soft', 'surface-soft', 4.5],
  ['ink-soft', 'accent-soft', 4.5],
  ['ink-soft', 'canvas', 4.5],
  ['ink-soft', 'warning-soft', 4.5],
  ['ink-soft', 'danger-soft', 4.5],
  ['on-accent', 'accent', 4.5],
  ['on-accent', 'accent-hover', 4.5],
  ['on-accent', 'danger-strong', 4.5],
  ['accent-ink', 'accent-soft', 4.5],
  ['accent-ink', 'surface', 4.5],
  ['accent-ink', 'shell', 4.5],
  ['accent-ink', 'surface-soft', 4.5],
  ['accent-ink', 'canvas', 4.5],
  ['sage', 'surface', 4.5],
  ['warning', 'surface', 4.5],
  ['sky', 'surface', 4.5],
  ['ink', 'cherry-soft', 4.5],
  ['cherry', 'cherry-soft', 4.5],
  ['cherry', 'surface', 4.5],
  ['apricot', 'apricot-soft', 4.5],
  ['sage', 'sage-soft', 4.5],
  ['sky', 'sky-soft', 4.5],
  ['danger', 'danger-soft', 4.5],
  ['danger', 'surface', 4.5],
  ['danger', 'shell', 4.5],
  ['warning', 'warning-soft', 4.5],
  ['line-strong', 'surface', 3],
  ['line-strong', 'shell', 3],
  ['focus', 'surface', 3],
  ['focus', 'shell', 3],
  ['mark', 'surface', 3],
  ['mark', 'canvas', 3],
]

describe.each([
  ['clair', light],
  ['sombre', dark],
])('contrastes WCAG AA, thème %s', (_name, tokens) => {
  it.each(PAIRS)('%s sur %s', (foreground, background, minimum) => {
    const fg = tokens[foreground]
    const bg = tokens[background]
    expect(fg, `token ${foreground} manquant`).toBeDefined()
    expect(bg, `token ${background} manquant`).toBeDefined()
    expect(contrast(fg ?? '', bg ?? '')).toBeGreaterThanOrEqual(minimum)
  })
})
