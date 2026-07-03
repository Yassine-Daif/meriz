import { useId } from 'react'
import type { Dispatch } from 'react'
import type { Association, Mcd } from '../model/mcd'
import type { McdAction } from '../model/mcdReducer'
import { resolveAttributes, unplacedProperties } from '../model/queries'
import { AttributesEditor } from './AttributesEditor'

interface AssociationFormProps {
  mcd: Mcd
  association: Association
  dispatch: Dispatch<McdAction>
}

/**
 * Formulaire d'édition d'une association : nom et attributs portés.
 * L'option identifiant n'est jamais proposée ici (invariant du modèle).
 */
export function AssociationForm({ mcd, association, dispatch }: AssociationFormProps) {
  const nameId = useId()
  return (
    <form onSubmit={(event) => event.preventDefault()} className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">Association</h2>
      <div>
        <label htmlFor={nameId} className="block text-xs font-medium text-zinc-600">
          Nom
        </label>
        <input
          id={nameId}
          type="text"
          value={association.name}
          onChange={(event) =>
            dispatch({ type: 'RENAME_ASSOCIATION', id: association.id, name: event.target.value })
          }
          className="mt-0.5 w-full rounded border border-zinc-300 px-2 py-1 text-sm"
        />
      </div>
      <AttributesEditor
        attributes={resolveAttributes(mcd, association.attributes)}
        unplaced={unplacedProperties(mcd)}
        allowIdentifier={false}
        onAdd={() => dispatch({ type: 'ADD_ATTRIBUTE', ownerId: association.id })}
        onPlace={(propertyId) =>
          dispatch({ type: 'PLACE_PROPERTY', ownerId: association.id, propertyId })
        }
        onRename={(propertyId, name) =>
          dispatch({ type: 'UPDATE_PROPERTY', propertyId, patch: { name } })
        }
        onChangeType={(propertyId, type) =>
          dispatch({ type: 'UPDATE_PROPERTY', propertyId, patch: { type } })
        }
        onRemove={(propertyId) =>
          dispatch({ type: 'REMOVE_ATTRIBUTE', ownerId: association.id, propertyId })
        }
      />
    </form>
  )
}
