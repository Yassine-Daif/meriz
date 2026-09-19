import { describe, expect, it } from 'vitest'
import { parseThemePreference, resolveTheme } from './theme'

describe('thème', () => {
  it('lit une préférence valide, et retombe sur Système sinon', () => {
    expect(parseThemePreference('light')).toBe('light')
    expect(parseThemePreference('dark')).toBe('dark')
    expect(parseThemePreference('system')).toBe('system')
    expect(parseThemePreference(null)).toBe('system')
    expect(parseThemePreference('violet')).toBe('system')
  })

  it('suit le système quand la préférence est Système', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })

  it('impose le choix explicite, quel que soit le système', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
})
