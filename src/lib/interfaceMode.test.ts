import { describe, expect, it } from 'vitest'
import { parseInterfaceMode, parseUsageCategory, recommendedMode, visibleViews } from './interfaceMode'
import { parseApiUser } from './authApi'
describe('Niveau de l’interface', () => {
  it('ne confond pas les catégories et les permissions', () => {
    expect(parseInterfaceMode('teacher')).toBeNull()
    expect(parseUsageCategory('admin')).toBeNull()
    expect(recommendedMode('student')).toBe('beginner')
    expect(recommendedMode('professional')).toBe('complete')
  })
  it('conserve le parcours dictionnaire, MCD, MLD et les aides', () => {
    expect(visibleViews('beginner')).toEqual(['dictionnaire', 'mcd', 'mld', 'apprendre', 'apropos'])
    expect(visibleViews('complete')).toEqual(expect.arrayContaining(['mpd', 'sql', 'code', 'mcd']))
  })
  it('tolère une ancienne API mais refuse des préférences mal formées', () => {
    const raw = { id: 1, name: 'Nom', email: 'a@example.org', role: 'student', is_academic: false }
    expect(parseApiUser(raw)).not.toBeNull()
    expect(parseApiUser({ ...raw, interface_mode: 'beginner', usage_category: 'teacher' })).toMatchObject({ interfaceMode: 'beginner', usageCategory: 'teacher', role: 'student' })
    expect(parseApiUser({ ...raw, interface_mode: ['beginner'] })).toBeNull()
    expect(parseApiUser({ ...raw, usage_category: 'admin' })).toBeNull()
  })
})
