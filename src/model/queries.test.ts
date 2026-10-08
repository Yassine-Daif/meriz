import { describe, expect, it } from 'vitest'
import { canCreateLeg } from './queries'
import { clientCommande } from './testFixtures'

const association = clientCommande.associations[0]!
const client = clientCommande.entities[0]!
const commande = clientCommande.entities[1]!

describe('canCreateLeg, le sens d’une patte', () => {
  it('accepte une association vers une entité', () => {
    expect(canCreateLeg(clientCommande, association.id, client.id)).toBe(true)
  })

  it('refuse le sens inverse, entité vers association', () => {
    expect(canCreateLeg(clientCommande, client.id, association.id)).toBe(false)
  })

  it('refuse une entité vers une entité', () => {
    expect(canCreateLeg(clientCommande, client.id, commande.id)).toBe(false)
  })

  it('refuse une association vers une association', () => {
    expect(canCreateLeg(clientCommande, association.id, association.id)).toBe(false)
  })

  it('refuse un identifiant inconnu, des deux côtés', () => {
    expect(canCreateLeg(clientCommande, 'inconnu', client.id)).toBe(false)
    expect(canCreateLeg(clientCommande, association.id, 'inconnu')).toBe(false)
  })

  it('refuse une connexion sans source ni cible', () => {
    expect(canCreateLeg(clientCommande, null, client.id)).toBe(false)
    expect(canCreateLeg(clientCommande, association.id, null)).toBe(false)
  })

  it('accepte une entité déjà reliée : une association peut être réflexive', () => {
    // Client porte déjà une patte de cette association dans la fixture.
    expect(association.legs.some((leg) => leg.entityId === client.id)).toBe(true)
    expect(canCreateLeg(clientCommande, association.id, client.id)).toBe(true)
  })
})
