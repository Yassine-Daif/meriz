import { describe, expect, it } from 'vitest'
import {
  isPasswordResetPath,
  readPasswordReset,
  urlWithoutPasswordReset,
} from './passwordResetLanding'

const LIEN = 'https://meriz.fr/reinitialiser-mot-de-passe?token=abc123&email=ada%40etu.fr'

describe('le lien reçu par courrier', () => {
  it('lit le jeton et l adresse', () => {
    expect(readPasswordReset(LIEN)).toEqual({ token: 'abc123', email: 'ada@etu.fr' })
  })

  // L application peut vivre dans un sous-dossier : les paramètres suffisent.
  it('accepte les paramètres seuls, et un sous-dossier', () => {
    expect(readPasswordReset('https://meriz.fr/?token=t&email=a@b.fr')).toEqual({
      token: 't',
      email: 'a@b.fr',
    })
    expect(readPasswordReset('https://meriz.fr/app/reinitialiser-mot-de-passe?token=t&email=a@b.fr')).toEqual({
      token: 't',
      email: 'a@b.fr',
    })
  })

  it('refuse un lien incomplet', () => {
    expect(readPasswordReset('https://meriz.fr/reinitialiser-mot-de-passe')).toBeNull()
    expect(readPasswordReset('https://meriz.fr/?token=abc')).toBeNull()
    expect(readPasswordReset('https://meriz.fr/?email=a@b.fr')).toBeNull()
    expect(readPasswordReset('https://meriz.fr/?token=%20&email=a@b.fr')).toBeNull()
    expect(readPasswordReset('pas une adresse')).toBeNull()
  })

  it('reconnaît le chemin de la page, avec ou sans barre finale', () => {
    expect(isPasswordResetPath(LIEN)).toBe(true)
    expect(isPasswordResetPath('https://meriz.fr/app/reinitialiser-mot-de-passe/')).toBe(true)
    expect(isPasswordResetPath('https://meriz.fr/')).toBe(false)
    expect(isPasswordResetPath('pas une adresse')).toBe(false)
  })
})

describe('le nettoyage de l adresse', () => {
  // Un jeton ouvre un compte : il ne reste ni dans l historique ni dans
  // un favori.
  it('retire le jeton et l adresse, et garde le reste', () => {
    expect(urlWithoutPasswordReset(LIEN)).toBe('https://meriz.fr/reinitialiser-mot-de-passe')
    expect(urlWithoutPasswordReset('https://meriz.fr/?token=t&email=a@b.fr&vue=mcd')).toBe(
      'https://meriz.fr/?vue=mcd',
    )
  })

  it('laisse intacte une adresse qui n en porte pas', () => {
    expect(urlWithoutPasswordReset('https://meriz.fr/app/')).toBe('https://meriz.fr/app/')
    expect(urlWithoutPasswordReset('pas une adresse')).toBe('pas une adresse')
  })
})
