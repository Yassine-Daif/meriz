import { useId } from 'react'
import type { Dispatch } from 'react'
import type { Association, Cardinality, Leg, Mcd } from '../model/mcd'
import type { McdAction } from '../model/mcdReducer'
import { findEntity } from '../model/queries'

// Les quatre seules cardinalités valides en Merise.
const CARDINALITY_OPTIONS: readonly Cardinality[] = [
  { min: 0, max: 1 },
  { min: 1, max: 1 },
  { min: 0, max: 'n' },
  { min: 1, max: 'n' },
]

interface LegFormProps {
  mcd: Mcd
  association: Association
  leg: Leg
  dispatch: Dispatch<McdAction>
}

/** Formulaire d'édition d'une patte : cardinalité et rôle. */
export function LegForm({ mcd, association, leg, dispatch }: LegFormProps) {
  const roleId = useId()
  const radioName = useId()
  const entity = findEntity(mcd, leg.entityId)

  return (
    <form onSubmit={(event) => event.preventDefault()} className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">Patte</h2>
      <p className="text-xs text-zinc-600">
        {association.name} → {entity ? entity.name : 'entité inexistante'}
      </p>

      <fieldset>
        <legend className="text-xs font-medium text-zinc-600">Cardinalité</legend>
        <div className="mt-1 flex gap-1">
          {CARDINALITY_OPTIONS.map((option) => {
            const label = `${option.min},${option.max}`
            const checked =
              leg.cardinality.min === option.min && leg.cardinality.max === option.max
            return (
              <label
                key={label}
                className={`flex-1 cursor-pointer rounded border px-2 py-1 text-center text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-700 ${
                  checked ? 'border-indigo-700 bg-indigo-50 font-semibold' : 'border-zinc-300'
                }`}
              >
                <input
                  type="radio"
                  name={radioName}
                  value={label}
                  checked={checked}
                  onChange={() =>
                    dispatch({ type: 'SET_LEG_CARDINALITY', legId: leg.id, cardinality: option })
                  }
                  className="sr-only"
                />
                {label}
              </label>
            )
          })}
        </div>
      </fieldset>

      <div>
        <label htmlFor={roleId} className="block text-xs font-medium text-zinc-600">
          Rôle
        </label>
        <input
          id={roleId}
          type="text"
          value={leg.role ?? ''}
          onChange={(event) =>
            dispatch({
              type: 'SET_LEG_ROLE',
              legId: leg.id,
              // Rôle effacé → champ optionnel absent du modèle.
              role: event.target.value === '' ? undefined : event.target.value,
            })
          }
          className="mt-0.5 w-full rounded border border-zinc-300 px-2 py-1 text-sm"
        />
        <p className="mt-0.5 text-xs text-zinc-500">
          Utile quand plusieurs pattes visent la même entité.
        </p>
      </div>
    </form>
  )
}
