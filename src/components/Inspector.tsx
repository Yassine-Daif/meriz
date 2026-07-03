import type { Dispatch, ReactNode } from 'react'
import type { Mcd } from '../model/mcd'
import type { McdAction } from '../model/mcdReducer'
import { findAssociation, findEntity, findLeg } from '../model/queries'
import type { CanvasSelection } from '../canvas/selection'
import { EntityForm } from './EntityForm'
import { AssociationForm } from './AssociationForm'
import { LegForm } from './LegForm'

interface InspectorProps {
  mcd: Mcd
  selection: CanvasSelection
  dispatch: Dispatch<McdAction>
}

/**
 * Panneau d'inspection : édite l'élément sélectionné dans le canvas
 * quand la sélection compte exactement un élément.
 */
export function Inspector({ mcd, selection, dispatch }: InspectorProps) {
  const selectedCount = selection.nodeIds.size + selection.edgeIds.size

  let content: ReactNode = (
    <p className="text-sm text-zinc-600">
      Sélectionnez une entité, une association ou une patte pour l'éditer.
    </p>
  )
  if (selectedCount > 1) {
    content = (
      <p className="text-sm text-zinc-600">
        {selectedCount} éléments sélectionnés. Déplacez-les ensemble, ou Suppr pour tout
        supprimer. Sélectionnez un seul élément pour l'éditer.
      </p>
    )
  }

  if (selectedCount === 1) {
    const nodeId = [...selection.nodeIds][0]
    const edgeId = [...selection.edgeIds][0]
    if (nodeId !== undefined) {
      const entity = findEntity(mcd, nodeId)
      const association = findAssociation(mcd, nodeId)
      if (entity) {
        content = <EntityForm mcd={mcd} entity={entity} dispatch={dispatch} />
      } else if (association) {
        content = <AssociationForm mcd={mcd} association={association} dispatch={dispatch} />
      }
    } else if (edgeId !== undefined) {
      const found = findLeg(mcd, edgeId)
      if (found) {
        content = (
          <LegForm mcd={mcd} association={found.association} leg={found.leg} dispatch={dispatch} />
        )
      }
    }
  }

  return (
    <section aria-label="Inspecteur" className="border-b border-zinc-200 p-3">
      {content}
    </section>
  )
}
