import { Fragment } from 'react'
import { describe, expect, it } from 'vitest'
import { selectEntries } from './selectOptions'

describe('options des menus de sélection', () => {
  it('conserve les valeurs vides et les libellés composés', () => {
    expect(selectEntries(<><option value="">Choisir</option><option value="p1">Nom ({'VARCHAR(150)'})</option></>)).toMatchObject([
      { kind: 'option', value: '', text: 'Choisir' }, { kind: 'option', value: 'p1', text: 'Nom (VARCHAR(150))' },
    ])
  })
  it('conserve les groupes, les tableaux, les langues et les choix désactivés', () => {
    expect(selectEntries(<Fragment>{false}{[<optgroup key="g" label="Types" disabled><option value="INT">INT</option></optgroup>, <option key="en" value="en" lang="en">English</option>]}</Fragment>)).toMatchObject([
      { kind: 'group', label: 'Types', options: [{ value: 'INT', disabled: true }] },
      { kind: 'option', value: 'en', lang: 'en', disabled: false },
    ])
  })
})
