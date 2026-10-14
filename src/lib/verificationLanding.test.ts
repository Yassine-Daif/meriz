import { describe, expect, it } from 'vitest'
import { readVerification, urlWithoutVerification } from './verificationLanding'

describe('le verdict porté par une adresse', () => {
  it('lit les quatre résultats du serveur', () => {
    for (const result of ['success', 'already', 'expired', 'invalid'] as const) {
      expect(readVerification(`https://meriz.fr/email-verifie?verification=${result}`)).toBe(result)
    }
  })

  it('accepte le seul paramètre, sans le chemin de retour', () => {
    expect(readVerification('https://meriz.fr/?verification=success')).toBe('success')
    expect(readVerification('https://meriz.fr/app/?verification=expired')).toBe('expired')
  })

  it('accepte le chemin de retour dans un sous-dossier, avec ou sans barre finale', () => {
    expect(readVerification('https://meriz.fr/app/email-verifie?verification=success')).toBe('success')
    expect(readVerification('https://meriz.fr/app/email-verifie/?verification=success')).toBe('success')
  })

  it('ne dit rien d une adresse ordinaire', () => {
    expect(readVerification('https://meriz.fr/')).toBeNull()
    expect(readVerification('https://meriz.fr/?page=classes')).toBeNull()
    expect(readVerification('pas une adresse')).toBeNull()
  })

  // Un paramètre inventé ne vaut pas mieux qu'un lien coupé : sur le
  // chemin de retour on le dit illisible, ailleurs on l'ignore.
  it('traite une valeur inconnue comme un lien illisible', () => {
    expect(readVerification('https://meriz.fr/email-verifie?verification=bidon')).toBe('invalid')
    expect(readVerification('https://meriz.fr/email-verifie')).toBe('invalid')
    expect(readVerification('https://meriz.fr/?verification=bidon')).toBeNull()
  })
})

describe('le nettoyage de l adresse', () => {
  it('retire le verdict et garde le reste', () => {
    expect(urlWithoutVerification('https://meriz.fr/email-verifie?verification=success')).toBe(
      'https://meriz.fr/email-verifie',
    )
    expect(urlWithoutVerification('https://meriz.fr/app/?verification=expired&vue=mcd')).toBe(
      'https://meriz.fr/app/?vue=mcd',
    )
  })

  it('laisse intacte une adresse sans verdict', () => {
    expect(urlWithoutVerification('https://meriz.fr/app/')).toBe('https://meriz.fr/app/')
    expect(urlWithoutVerification('pas une adresse')).toBe('pas une adresse')
  })
})
