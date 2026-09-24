import { describe, expect, it } from 'vitest'
import { translateValidationMessage } from './validationMessages'

describe('traduction des messages de validation du serveur', () => {
  it('traduit les règles Laravel connues', () => {
    expect(translateValidationMessage('name', 'The name field is required.')).toBe('Ce champ est obligatoire.')
    expect(translateValidationMessage('email', 'The email field must be a valid email address.')).toBe(
      'Adresse email invalide.',
    )
    expect(translateValidationMessage('email', 'The email has already been taken.')).toBe(
      'Un compte existe déjà avec cette adresse email.',
    )
    expect(translateValidationMessage('code', 'The code has already been taken.')).toBe(
      'Cette valeur est déjà utilisée.',
    )
    expect(translateValidationMessage('password', 'The password field must be at least 8 characters.')).toBe(
      '8 caractères minimum.',
    )
    expect(translateValidationMessage('password', 'The password field must not be greater than 72 characters.')).toBe(
      '72 caractères maximum.',
    )
    expect(translateValidationMessage('name', 'The name field must be a string.')).toBe('Valeur invalide.')
  })

  it('traduit le refus d’un fichier trop lourd', () => {
    expect(translateValidationMessage('file', 'The file field must not be greater than 2048 kilobytes.')).toBe(
      'Fichier trop lourd : 2048 Ko au plus.',
    )
    // Les caractères et les kilo-octets ne se confondent pas.
    expect(translateValidationMessage('title', 'The title field must not be greater than 200 characters.')).toBe(
      '200 caractères maximum.',
    )
  })

  it('laisse intact un message inconnu ou déjà en français', () => {
    expect(translateValidationMessage('email', 'Email ou mot de passe incorrect.')).toBe(
      'Email ou mot de passe incorrect.',
    )
    expect(translateValidationMessage('x', 'Something unusual.')).toBe('Something unusual.')
  })
})
