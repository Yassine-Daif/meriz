import { describe, expect, it } from 'vitest'
import { mcdToFlow } from './mcdToFlow'
import { clientCommande } from '../model/testFixtures'

const layout = { 'ent-client': { x: 0, y: 0 }, 'ent-commande': { x: 400, y: 0 } }

describe('mcdToFlow, du modèle à la vue', () => {
  it('ne fige aucun côté d’accroche sur les pattes', () => {
    // Le côté dépend des tailles mesurées et des positions vivantes : il se
    // choisit dans le canevas, à chaque image. Le laisser entrer ici ferait
    // revenir le retard d'un cran qu'on vient de corriger.
    const { edges } = mcdToFlow(clientCommande, layout)

    expect(edges.length).toBeGreaterThan(0)
    for (const edge of edges) {
      expect(edge.sourceHandle).toBeUndefined()
      expect(edge.targetHandle).toBeUndefined()
    }
  })

  it('fait partir chaque patte de son association vers son entité', () => {
    const { edges } = mcdToFlow(clientCommande, layout)
    const association = clientCommande.associations[0]!

    for (const edge of edges) {
      expect(edge.source).toBe(association.id)
      expect(clientCommande.entities.map((entity) => entity.id)).toContain(edge.target)
      expect(edge.ariaLabel).toMatch(/^Patte de .+ vers .+, cardinalité \d+,[\dn]+$/)
    }
  })
})
