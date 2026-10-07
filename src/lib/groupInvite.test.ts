import { describe, expect, it } from 'vitest'
import { discordMessage, invitationMailto, invitationMessage, invitationSubject } from './groupInvite'

const params = {
  groupName: 'Projet Merise',
  joinCode: 'ABCD2345',
  appUrl: 'https://meriz.example/app/',
}

describe('invitation à un groupe', () => {
  it('porte le nom, le code lisible et l’adresse', () => {
    const message = invitationMessage(params)

    expect(message).toContain('« Projet Merise »')
    expect(message).toContain('Code du groupe : ABCD-2345')
    expect(message).toContain('Mes groupes')
    expect(message).toContain('https://meriz.example/app/')
  })

  it('dit que la saisie est tolérante', () => {
    expect(invitationMessage(params)).toContain('minuscules, les espaces et les tirets sont acceptés')
  })

  it('n’écrit aucun tiret long', () => {
    // La règle du dépôt : on ne l'écrit donc pas non plus ici.
    const tiretLong = String.fromCharCode(0x2014)
    expect(invitationMessage(params)).not.toContain(tiretLong)
    expect(discordMessage(params)).not.toContain(tiretLong)
    expect(invitationSubject('Projet Merise')).not.toContain(tiretLong)
  })

  it('met le code en évidence pour Discord', () => {
    expect(discordMessage(params)).toContain('`ABCD-2345`')
  })

  it('prépare un courrier sans destinataire, décodable tel quel', () => {
    const lien = invitationMailto(params)

    expect(lien.startsWith('mailto:?subject=')).toBe(true)
    const query = new URLSearchParams(lien.slice('mailto:?'.length))
    expect(query.get('subject')).toBe('Rejoins mon groupe « Projet Merise » sur Meriz')
    expect(query.get('body')).toBe(invitationMessage(params))
  })

  it('normalise un code saisi autrement', () => {
    expect(invitationMessage({ ...params, joinCode: 'abcd-2345' })).toContain('ABCD-2345')
  })
})
