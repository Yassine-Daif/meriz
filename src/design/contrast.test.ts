import { describe, expect, it } from 'vitest'
import css from '../index.css?raw'
import { contrastRatio } from '../lib/color'

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


/**
 * [texte ou trait, fond, minimum]. 4,5 pour le texte, 3 pour les contours
 * et les traits. La table couvre chaque couple que l'interface emploie
 * vraiment, et elle ne fait que grandir : on n'abaisse jamais un minimum
 * pour faire passer une couleur, on change la couleur.
 */
const PAIRS: [string, string, number][] = [
  // L'encre sur tous les fonds, y compris les fonds doux des badges et
  // des encarts, où du texte normal se pose.
  ['ink', 'shell', 4.5],
  ['ink', 'surface', 4.5],
  ['ink', 'surface-soft', 4.5],
  ['ink', 'canvas', 4.5],
  ['ink', 'accent-soft', 4.5],
  ['ink', 'warning-soft', 4.5],
  ['ink', 'danger-soft', 4.5],
  ['ink', 'sky-soft', 4.5],
  ['ink', 'sage-soft', 4.5],
  ['ink', 'cherry-soft', 4.5],
  ['ink', 'apricot-soft', 4.5],
  // L'encre douce porte les textes secondaires, partout où l'encre va.
  ['ink-soft', 'shell', 4.5],
  ['ink-soft', 'surface', 4.5],
  ['ink-soft', 'surface-soft', 4.5],
  ['ink-soft', 'canvas', 4.5],
  ['ink-soft', 'accent-soft', 4.5],
  ['ink-soft', 'warning-soft', 4.5],
  ['ink-soft', 'danger-soft', 4.5],
  ['ink-soft', 'sage-soft', 4.5],
  ['ink-soft', 'sky-soft', 4.5],
  ['ink-soft', 'cherry-soft', 4.5],
  ['ink-soft', 'apricot-soft', 4.5],
  // Les boutons pleins, au repos et au survol.
  ['on-accent', 'accent', 4.5],
  ['on-accent', 'accent-hover', 4.5],
  ['on-accent', 'danger-strong', 4.5],
  // Les liens et le texte accentué.
  ['accent-ink', 'accent-soft', 4.5],
  ['accent-ink', 'surface', 4.5],
  ['accent-ink', 'shell', 4.5],
  ['accent-ink', 'surface-soft', 4.5],
  ['accent-ink', 'canvas', 4.5],
  // Chaque teinte de provenance sur une carte, sur le fond de page, et
  // sur son propre fond doux : un badge se pose dans les trois cas.
  ['sage', 'surface', 4.5],
  ['warning', 'surface', 4.5],
  ['sky', 'surface', 4.5],
  ['apricot', 'surface', 4.5],
  ['cherry', 'surface', 4.5],
  ['danger', 'surface', 4.5],
  ['sage', 'shell', 4.5],
  ['warning', 'shell', 4.5],
  ['sky', 'shell', 4.5],
  ['apricot', 'shell', 4.5],
  ['cherry', 'shell', 4.5],
  ['danger', 'shell', 4.5],
  ['cherry', 'cherry-soft', 4.5],
  ['apricot', 'apricot-soft', 4.5],
  ['sage', 'sage-soft', 4.5],
  ['sky', 'sky-soft', 4.5],
  ['danger', 'danger-soft', 4.5],
  ['warning', 'warning-soft', 4.5],
  // Contours, focus et traits du schéma : 3:1 suffit, mais partout.
  ['line-strong', 'surface', 3],
  ['line-strong', 'shell', 3],
  ['line-strong', 'surface-soft', 3],
  ['focus', 'surface', 3],
  ['focus', 'shell', 3],
  ['focus', 'canvas', 3],
  ['mark', 'surface', 3],
  ['mark', 'canvas', 3],
  ['mark', 'shell', 3],
  // Un rond de liaison est posé à cheval sur le bord d'un bloc : son
  // disque et son cercle doivent se voir sur la zone de dessin comme sur
  // le fond d'une association, et le bord du bloc aussi.
  ['line-strong', 'canvas', 3],
  ['line-strong', 'accent-soft', 3],
  ['mark', 'accent-soft', 3],
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
    expect(contrastRatio(fg ?? '', bg ?? '')).toBeGreaterThanOrEqual(minimum)
  })
})
