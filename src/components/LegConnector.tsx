import { useId, useRef, useState } from 'react'
import type { Dispatch } from 'react'
import type { Association, Mcd } from '../model/mcd'
import type { McdAction } from '../model/mcdReducer'

interface LegConnectorProps {
  mcd: Mcd
  association: Association
  dispatch: Dispatch<McdAction>
}

/**
 * Création d'une patte au clavier, équivalent du glisser de handle :
 * on choisit l'entité à relier à l'association sélectionnée. Le sens
 * reste toujours association vers entité. Toutes les entités sont
 * proposées, y compris une entité déjà reliée (association réflexive,
 * la validation exige alors un rôle par patte).
 */
export function LegConnector({ mcd, association, dispatch }: LegConnectorProps) {
  const selectId = useId()
  const selectRef = useRef<HTMLSelectElement>(null)
  const [entityId, setEntityId] = useState('')
  const [announcement, setAnnouncement] = useState('')

  const handleConnect = () => {
    const entity = mcd.entities.find((e) => e.id === entityId)
    if (!entity) {
      return
    }
    dispatch({ type: 'ADD_LEG', associationId: association.id, entityId: entity.id })
    setEntityId('')
    setAnnouncement(
      `Patte créée de ${association.name} vers ${entity.name}, cardinalité 1,1 par défaut. Sélectionnez la patte pour la modifier.`,
    )
    // Le bouton se désactive : le focus revient sur la liste plutôt que
    // de se perdre dans la page.
    selectRef.current?.focus()
  }

  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5">
      <legend className="text-xs font-medium text-zinc-600">Relier à une entité</legend>
      {mcd.entities.length === 0 ? (
        <p className="text-xs text-zinc-500">Aucune entité à relier : ajoutez d'abord une entité.</p>
      ) : (
        <div className="flex min-w-0 items-center gap-2">
          <label htmlFor={selectId} className="sr-only">
            Entité à relier à l'association {association.name}
          </label>
          <select
            id={selectId}
            ref={selectRef}
            value={entityId}
            onChange={(event) => setEntityId(event.target.value)}
            className="min-w-0 flex-1 rounded border border-zinc-300 bg-surface px-1.5 py-1 text-xs"
          >
            <option value="">Choisir une entité</option>
            {mcd.entities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleConnect}
            disabled={entityId === ''}
            className="shrink-0 rounded border border-zinc-300 bg-surface px-2 py-1 text-xs hover:bg-shell disabled:cursor-not-allowed disabled:opacity-50"
          >
            Relier
          </button>
        </div>
      )}
      <p role="status" aria-live="polite" className="text-xs text-zinc-600">
        {announcement}
      </p>
    </fieldset>
  )
}
