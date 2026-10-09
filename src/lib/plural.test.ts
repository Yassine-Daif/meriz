import { describe, expect, it } from 'vitest'
import { plural } from './plural'

describe('accord en nombre', () => {
  it('garde le singulier à zéro', () => {
    expect(plural(0, 'classe', 'classes')).toBe('classe')
  })

  it('garde le singulier à un', () => {
    expect(plural(1, 'classe', 'classes')).toBe('classe')
  })

  it('passe au pluriel à deux', () => {
    expect(plural(2, 'classe', 'classes')).toBe('classes')
  })
})
