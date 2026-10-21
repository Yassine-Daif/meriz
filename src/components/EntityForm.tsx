import { t } from "../i18n/runtime"
import { useLanguage } from "../lib/useLanguage"
import { useId } from 'react'
import type { Dispatch } from 'react'
import type { Entity, Mcd } from '../model/mcd'
import type { McdAction } from '../model/mcdReducer'
import { resolveAttributes, unplacedProperties } from '../model/queries'
import { AttributesEditor } from './AttributesEditor'

interface EntityFormProps {
  mcd: Mcd
  entity: Entity
  dispatch: Dispatch<McdAction>
}

/** Formulaire d'édition d'une entité : nom et attributs. */
export function EntityForm({ mcd, entity, dispatch }: EntityFormProps) {
  useLanguage()
  const nameId = useId()
  return (
    <form onSubmit={(event) => event.preventDefault()} className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">{t("Entité")}</h2>
      <div>
        <label htmlFor={nameId} className="block text-xs font-medium text-ink-soft">
          {t("Nom")}</label>
        <input
          id={nameId}
          type="text"
          value={entity.name}
          onChange={(event) =>
            dispatch({ type: 'RENAME_ENTITY', id: entity.id, name: event.target.value })
          }
          className="mt-0.5 w-full rounded-lg border border-line-strong px-2 py-1 text-sm"
        />
      </div>
      <AttributesEditor
        attributes={resolveAttributes(mcd, entity.attributes)}
        unplaced={unplacedProperties(mcd)}
        allowIdentifier
        onAdd={() => dispatch({ type: 'ADD_ATTRIBUTE', ownerId: entity.id })}
        onPlace={(propertyId) =>
          dispatch({ type: 'PLACE_PROPERTY', ownerId: entity.id, propertyId })
        }
        onRename={(propertyId, name) =>
          dispatch({ type: 'UPDATE_PROPERTY', propertyId, patch: { name } })
        }
        onChangeType={(propertyId, type) =>
          dispatch({ type: 'UPDATE_PROPERTY', propertyId, patch: { type } })
        }
        onToggleIdentifier={(propertyId, isIdentifier) =>
          dispatch({
            type: 'SET_ATTRIBUTE_IDENTIFIER',
            entityId: entity.id,
            propertyId,
            isIdentifier,
          })
        }
        onRemove={(propertyId) =>
          dispatch({ type: 'REMOVE_ATTRIBUTE', ownerId: entity.id, propertyId })
        }
      />
    </form>
  )
}
