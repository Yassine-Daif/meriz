import { describe, expect, it } from 'vitest'
import { formatDate, formatRelativeDate } from './formatDate'

/** Instant de référence : jeudi 24 septembre 2026, 18:00 UTC. */
const NOW = new Date('2026-09-24T18:00:00Z').getTime()
const ago = (millis: number) => new Date(NOW - millis).toISOString()

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe('date complète', () => {
  it('écrit la date en clair, et se replie sur l’illisible', () => {
    expect(formatDate('2026-09-24T18:00:00Z')).toContain('septembre 2026')
    expect(formatDate('pas une date')).toBe('date inconnue')
  })
})

describe('date relative', () => {
  it('parle en minutes et en heures pour les dates du jour', () => {
    // Moins d'une minute : Intl parle du présent, pas d'un décompte.
    expect(formatRelativeDate(ago(10_000), NOW)).not.toContain('minute')

    expect(formatRelativeDate(ago(5 * MINUTE), NOW)).toBe('il y a 5 minutes')
    expect(formatRelativeDate(ago(59 * MINUTE), NOW)).toBe('il y a 59 minutes')
    expect(formatRelativeDate(ago(2 * HOUR), NOW)).toBe('il y a 2 heures')
    expect(formatRelativeDate(ago(23 * HOUR), NOW)).toBe('il y a 23 heures')
  })

  it('parle en jours jusqu’à une semaine', () => {
    // La veille a son mot en français, Intl le connaît.
    expect(formatRelativeDate(ago(DAY), NOW)).toBe('hier')
    expect(formatRelativeDate(ago(3 * DAY), NOW)).toBe('il y a 3 jours')
    expect(formatRelativeDate(ago(6 * DAY), NOW)).toBe('il y a 6 jours')
  })

  it('passe à la date du jour au-delà d’une semaine', () => {
    expect(formatRelativeDate(ago(7 * DAY), NOW)).toBe('le 17 septembre')
    expect(formatRelativeDate(ago(30 * DAY), NOW)).toBe('le 25 août')
  })

  it('ajoute l’année quand ce n’est plus l’année courante', () => {
    const relative = formatRelativeDate('2025-09-20T10:00:00Z', NOW)

    expect(relative).toContain('septembre')
    expect(relative).toContain('2025')
    // L'année courante, elle, reste implicite.
    expect(formatRelativeDate(ago(30 * DAY), NOW)).not.toContain('2026')
  })

  it('traite une date à venir comme le présent, sans « dans »', () => {
    const futur = formatRelativeDate(new Date(NOW + 5 * HOUR).toISOString(), NOW)

    expect(futur).not.toBeNull()
    expect(futur).not.toContain('dans')
  })

  it('rend null pour une date illisible', () => {
    expect(formatRelativeDate('pas une date', NOW)).toBeNull()
    expect(formatRelativeDate('', NOW)).toBeNull()
  })
})
